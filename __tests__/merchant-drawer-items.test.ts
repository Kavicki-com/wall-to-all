import {
  MERCHANT_DRAWER_ITEMS,
  MERCHANT_HOME_DRAWER_ITEMS,
} from '../components/layout/merchantDrawerItems';

const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe('merchant drawer items (F7)', () => {
  it.each([
    ['MERCHANT_DRAWER_ITEMS', MERCHANT_DRAWER_ITEMS],
    ['MERCHANT_HOME_DRAWER_ITEMS', MERCHANT_HOME_DRAWER_ITEMS],
  ])('%s: "Assinatura" logo depois de "Perfil"', (_name, items) => {
    const list = labels(items);
    expect(list[list.indexOf('Perfil') + 1]).toBe('Assinatura');
    expect(items.find((item) => item.label === 'Assinatura')?.route).toBe('/(merchant)/assinatura');
  });

  it('keeps "Compartilhar perfil" only on the home variant', () => {
    expect(labels(MERCHANT_HOME_DRAWER_ITEMS)).toContain('Compartilhar perfil');
    expect(labels(MERCHANT_DRAWER_ITEMS)).not.toContain('Compartilhar perfil');
  });

  it.each([
    ['MERCHANT_DRAWER_ITEMS', MERCHANT_DRAWER_ITEMS],
    ['MERCHANT_HOME_DRAWER_ITEMS', MERCHANT_HOME_DRAWER_ITEMS],
  ])('%s has no duplicated labels', (_name, items) => {
    const list = labels(items);
    expect(new Set(list).size).toBe(list.length);
  });
});
