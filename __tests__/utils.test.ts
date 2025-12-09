import { calculateAppointmentPrice } from '../lib/utils';

describe('calculateAppointmentPrice', () => {
  it('retorna preço fixo sem alteração', () => {
    expect(calculateAppointmentPrice(100, 'fixed', 30)).toBe(100);
  });

  it('calcula preço por hora com base na duração', () => {
    expect(calculateAppointmentPrice(120, 'hourly', 90)).toBe(180);
  });

  it('retorna 0 se preço base for 0', () => {
    expect(calculateAppointmentPrice(0, 'hourly', 60)).toBe(0);
  });
});

