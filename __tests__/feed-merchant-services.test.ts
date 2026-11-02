import { fetchLinkableServices } from '../lib/feed/merchantServices';

// Registra a cadeia de chamadas para conferir a consulta.
const mockCalls: { method: string; args: unknown[] }[] = [];
let mockResult: { data: unknown; error: unknown } = { data: [], error: null };

jest.mock('../lib/supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) {
    builder[method] = (...args: unknown[]) => {
      mockCalls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve(mockResult);
  return {
    supabase: {
      from: (table: string) => {
        mockCalls.push({ method: 'from', args: [table] });
        return builder;
      },
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockResult = { data: [], error: null };
});

describe('fetchLinkableServices', () => {
  it('consulta os serviços ativos da loja ordenados por nome', async () => {
    await fetchLinkableServices(42);
    expect(mockCalls).toEqual([
      { method: 'from', args: ['services'] },
      { method: 'select', args: ['id,name,price,duration_minutes'] },
      { method: 'eq', args: ['business_id', 42] },
      { method: 'eq', args: ['is_active', true] },
      { method: 'order', args: ['name'] },
    ]);
  });

  it('mapeia para FeedLinkedService com preço em centavos', async () => {
    mockResult = {
      data: [
        { id: 7, name: 'Corte feminino', price: 80, duration_minutes: 60 },
        { id: 8, name: 'Escova', price: 45.5, duration_minutes: 30 },
      ],
      error: null,
    };
    await expect(fetchLinkableServices(42)).resolves.toEqual([
      { serviceId: 7, name: 'Corte feminino', priceCents: 8000, durationMinutes: 60 },
      { serviceId: 8, name: 'Escova', priceCents: 4550, durationMinutes: 30 },
    ]);
  });

  it('data nulo vira lista vazia', async () => {
    mockResult = { data: null, error: null };
    await expect(fetchLinkableServices(42)).resolves.toEqual([]);
  });

  it('erro do Supabase rejeita', async () => {
    mockResult = { data: null, error: { message: 'boom' } };
    await expect(fetchLinkableServices(42)).rejects.toBeTruthy();
  });
});
