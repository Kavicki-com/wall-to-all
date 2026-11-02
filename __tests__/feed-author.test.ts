import { buildHandle, toFeedAuthor } from '../lib/feed/author';

describe('buildHandle', () => {
  it.each([
    ['Ana Cabelos', '@anaCabelos'],
    ['Bella Boutique', '@bellaBoutique'],
    ['Salão São João', '@salaoSaoJoao'],
    ['  Mix   Magazine ', '@mixMagazine'],
    ['Barbearia 2 Irmãos', '@barbearia2Irmaos'],
    ['', '@loja'],
    ['!!! ###', '@loja'],
  ])('"%s" vira %s', (input, expected) => {
    expect(buildHandle(input)).toBe(expected);
  });
});

describe('toFeedAuthor', () => {
  it('mapeia o perfil do negócio para o autor do feed', () => {
    expect(toFeedAuthor({ id: 7, business_name: 'Ana Cabelos', logo_url: null })).toEqual({
      businessId: 7,
      name: 'Ana Cabelos',
      handle: '@anaCabelos',
      logoUrl: null,
    });
  });
});
