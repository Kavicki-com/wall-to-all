import { getInitials } from '../../lib/formatters';

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
