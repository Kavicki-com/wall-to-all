/**
 * Testes do helper puro da mensagem de convite do QI (F4, Tasks 8 e 11).
 *
 * `buildQiShareMessage` é a fonte ÚNICA do texto do convite: a tela do QI
 * (Task 8) e o "Como funciona o QI" (Task 11) importam o mesmo helper para não
 * divergirem. Como é copy que o usuário envia a terceiros, o código de indicação
 * e o link ficam fixados aqui: mudá-los é decisão de produto, não refactor.
 */
import { buildQiShareMessage, QI_INVITE_URL } from '../lib/qi/shareMessage';

describe('buildQiShareMessage', () => {
  it('interpola o código recebido (não embute um código fixo)', () => {
    // Um código diferente do da fixture prova que o valor vem do argumento.
    expect(buildQiShareMessage('QI-TESTE-0001')).toContain('QI-TESTE-0001');
    expect(buildQiShareMessage('QI-HOG23-3892')).toContain('QI-HOG23-3892');
  });

  it('inclui o link de convite compartilhado', () => {
    expect(buildQiShareMessage('QI-HOG23-3892')).toContain(QI_INVITE_URL);
  });

  it('fixa o link de convite do QI', () => {
    expect(QI_INVITE_URL).toBe('https://wall-to-all.com/qi');
  });
});
