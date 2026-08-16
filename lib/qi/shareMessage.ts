/**
 * Mensagem de convite do QI compartilhada via `Share.share` (F4 — Tasks 8 e 11).
 *
 * Fonte ÚNICA do texto do convite: a tela do QI (Task 8) e o "Como funciona o
 * QI" (Task 11) importam `buildQiShareMessage` para não divergirem. O código de
 * indicação entra no corpo da mensagem junto de um link de convite.
 */

/**
 * Link de convite do QI. O domínio é o do aplicativo (`wall-to-all.com`, o mesmo
 * do compartilhamento de perfil do lojista); a rota `/qi` é placeholder até
 * existir uma rota real de captação (unificação com o backend em F-futuro).
 * Mantido como constante para um único ponto de troca quando o link definitivo
 * existir.
 */
export const QI_INVITE_URL = 'https://wall-to-all.com/qi';

/**
 * Monta a mensagem pt-BR de convite do QI com o `code` do usuário e o link de
 * convite. Reusada pela tela do QI (compartilhar código) e pelo "Como funciona".
 * A marca citada é a do aplicativo ("Wall-to-all", grafia já usada no
 * compartilhamento de perfil do lojista), não a da empresa (Kavicki).
 */
export function buildQiShareMessage(code: string): string {
  return (
    `Use meu código ${code} no Wall-to-all e ganhe cashback nos seus agendamentos! ` +
    `Baixe o app e cadastre-se pelo link: ${QI_INVITE_URL}`
  );
}
