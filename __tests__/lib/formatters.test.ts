import { getInitials, formatReais } from '../../lib/formatters';

describe('formatReais', () => {
  it('formata reais sem casas decimais no padrão pt-BR', () => {
    // O Intl usa espaço não-quebrável (U+00A0) entre "R$" e o número;
    // normalizamos para espaço comum na asserção.
    const norm = (v: number) => formatReais(v).replace(/\s/g, ' ');
    expect(norm(6000)).toBe('R$ 6.000');
    expect(norm(4250)).toBe('R$ 4.250');
    expect(norm(0)).toBe('R$ 0');
  });
});

describe('getInitials', () => {
  it('usa a primeira e a última inicial, em maiúsculas', () => {
    expect(getInitials('João Pedro')).toBe('JP');
    expect(getInitials('ana beatriz souza')).toBe('AS');
  });

  it('retorna uma única inicial para nome de uma palavra', () => {
    expect(getInitials('Você')).toBe('V');
  });

  it('ignora espaços extras e trata nome vazio', () => {
    expect(getInitials('   Maria   Silva  ')).toBe('MS');
    expect(getInitials('   ')).toBe('?');
    expect(getInitials('')).toBe('?');
  });
});
