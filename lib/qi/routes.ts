/**
 * Rotas das telas do QI, espelhadas por grupo (F4).
 *
 * Fonte ÚNICA do mapa lado → grupo de rotas: a tela do QI (`QiScreen`) e o saque
 * (`QiWithdrawScreen`) empurram sub-telas do QI e, antes disto, cada uma
 * carregava a própria cópia do mapa. Mesmo motivo de existir do irmão
 * `lib/qi/shareMessage.ts`: duas telas precisavam do mesmo dado e não podem
 * divergir. Constante pura, sem React, sem serviço e sem estado, então importá-la
 * não acopla as telas a nada.
 */
import type { QiSide } from '../services/types';

/**
 * Grupo de rotas de cada lado do app. `Record` exaustivo de propósito: um valor
 * novo de `QiSide` quebra a compilação aqui, em vez de cair silenciosamente num
 * grupo existente.
 */
export const QI_ROUTE_GROUP: Record<QiSide, '(client)' | '(merchant)'> = {
  client: '(client)',
  merchant: '(merchant)',
};

/**
 * Caminho de uma sub-tela do QI no grupo do lado informado, por exemplo
 * `qiRoute('merchant', 'withdraw')` devolve `/(merchant)/qi/withdraw`. O `sub` é
 * o trecho depois de `qi/` e pode conter mais de um segmento
 * (`indicacao/${id}`).
 *
 * TODO(F8): este é o ÚNICO ponto a tipar quando o projeto ligar as typed routes
 * do expo-router. Hoje o retorno é `string`, então um `sub` inexistente só falha
 * em runtime; com as typed routes ligadas, o retorno passa a ser o `Href` gerado
 * e o erro vira de compilação, para todos os chamadores de uma vez.
 */
export const qiRoute = (side: QiSide, sub: string): string =>
  `/${QI_ROUTE_GROUP[side]}/qi/${sub}`;
