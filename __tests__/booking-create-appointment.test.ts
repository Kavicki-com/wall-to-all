/**
 * Teste de caracterização do `createAppointment` (F5, Task 2): o corpo do
 * antigo `handleConfirm` de `schedule/confirm.tsx` movido para `lib/booking`,
 * sem mudança de comportamento. Supabase mockado no escopo do módulo com um
 * builder encadeável por tabela (insert/select/eq/single).
 */
import {
  BookingError,
  createAppointment,
  notifyAppointmentCreated,
} from '../lib/booking/createAppointment';
import type { AppointmentDraft } from '../lib/booking/createAppointment';
import { checkAppointmentConflicts } from '../lib/utils';
import { notifyAppointmentRequested } from '../lib/notifications';

const mockGetUser = jest.fn();
const mockInsert = jest.fn();
const mockInsertResult: { data: unknown; error: unknown } = { data: null, error: null };
const mockSingleData: Record<string, unknown> = {};

jest.mock('../lib/supabase', () => {
  const buildQuery = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq']) {
      builder[method] = () => builder;
    }
    builder.insert = (payload: unknown) => {
      mockInsert(payload);
      return builder;
    };
    builder.single = () =>
      Promise.resolve(
        table === 'appointments'
          ? mockInsertResult
          : { data: mockSingleData[table] ?? null, error: null },
      );
    return builder;
  };
  return {
    supabase: {
      auth: { getUser: () => mockGetUser() },
      from: (table: string) => buildQuery(table),
    },
  };
});

jest.mock('../lib/utils', () => ({ checkAppointmentConflicts: jest.fn() }));
jest.mock('../lib/notifications', () => ({ notifyAppointmentRequested: jest.fn() }));
jest.mock('../lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const mockedConflicts = checkAppointmentConflicts as jest.MockedFunction<
  typeof checkAppointmentConflicts
>;
const mockedNotify = notifyAppointmentRequested as jest.MockedFunction<
  typeof notifyAppointmentRequested
>;

const DRAFT: AppointmentDraft = {
  businessId: 10,
  serviceId: 20,
  serviceName: 'Corte',
  durationMinutes: 60,
  date: '2099-03-15',
  time: '10:00',
  paymentMethod: 'card',
  observations: 'Sem pressa',
};

const expectedStart = new Date('2099-03-15T10:00:00').toISOString();
const expectedEnd = new Date(new Date('2099-03-15T10:00:00').getTime() + 60 * 60000).toISOString();

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BookingError);
  await promise.catch((e: BookingError) => expect(e.code).toBe(code));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mockedConflicts.mockResolvedValue({ hasConflict: false });
  mockedNotify.mockResolvedValue(undefined);
  mockInsertResult.data = { id: 77 };
  mockInsertResult.error = null;
  mockSingleData.profiles = { full_name: 'Ana' };
  mockSingleData.business_profiles = { owner_id: 'owner-9' };
});

describe('createAppointment', () => {
  it('inserts the pending appointment and notifies the merchant', async () => {
    const result = await createAppointment(DRAFT);

    expect(mockedConflicts).toHaveBeenCalledWith(10, expectedStart, expectedEnd);
    expect(mockInsert).toHaveBeenCalledWith({
      client_id: 'user-1',
      business_id: 10,
      service_id: 20,
      start_time: expectedStart,
      end_time: expectedEnd,
      status: 'pending',
      payment_method: 'card',
      client_notes: 'Sem pressa',
    });
    expect(result).toEqual({ id: 77, startTime: expectedStart, endTime: expectedEnd });
    expect(mockedNotify).toHaveBeenCalledWith('owner-9', 77, 'Ana', 'Corte', expectedStart);
  });

  it('sends null client_notes when observations are empty', async () => {
    await createAppointment({ ...DRAFT, observations: '' });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ client_notes: null }));
  });

  it('throws unauthenticated without a user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expectCode(createAppointment(DRAFT), 'unauthenticated');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('throws invalid_time for a malformed time', async () => {
    await expectCode(createAppointment({ ...DRAFT, time: '25:99' }), 'invalid_time');
  });

  it('throws past_date for a past date', async () => {
    await expectCode(createAppointment({ ...DRAFT, date: '2000-01-01' }), 'past_date');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('throws conflict when the slot is taken', async () => {
    mockedConflicts.mockResolvedValue({ hasConflict: true });
    await expectCode(createAppointment(DRAFT), 'conflict');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('throws insert_failed when the insert errors', async () => {
    mockInsertResult.data = null;
    mockInsertResult.error = { message: 'boom' };
    await expectCode(createAppointment(DRAFT), 'insert_failed');
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it('does not throw when the notification fails (best effort)', async () => {
    mockedNotify.mockRejectedValue(new Error('rls'));
    await expect(createAppointment(DRAFT)).resolves.toMatchObject({ id: 77 });
  });

  // F8: no pagamento online a reserva vem antes da cobrança e não notifica.
  it('does not notify with notify: false', async () => {
    const result = await createAppointment(DRAFT, { notify: false });
    expect(result.id).toBe(77);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it('notifyAppointmentCreated notifies the merchant of an existing reservation', async () => {
    await notifyAppointmentCreated(DRAFT, { id: 77, startTime: expectedStart, endTime: expectedEnd });
    expect(mockedNotify).toHaveBeenCalledWith('owner-9', 77, 'Ana', 'Corte', expectedStart);
  });

  it('notifyAppointmentCreated never throws (best effort)', async () => {
    mockGetUser.mockRejectedValue(new Error('offline'));
    await expect(
      notifyAppointmentCreated(DRAFT, { id: 77, startTime: expectedStart, endTime: expectedEnd }),
    ).resolves.toBeUndefined();
    expect(mockedNotify).not.toHaveBeenCalled();
  });
});
