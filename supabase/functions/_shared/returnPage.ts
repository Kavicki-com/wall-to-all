/**
 * Retorno do Account Link (`connect-return`). Puro.
 *
 * O Account Link exige URL https, e o app usa o scheme `walltoall://`; a
 * função faz a ponte com um redirect 302 para o deep link. Não serve HTML: o
 * domínio padrão das Edge Functions entrega `text/html` como texto puro, então
 * o corpo é só uma mensagem curta para o caso de o navegador não abrir o app.
 * A entrada nunca é ecoada: estado desconhecido vira `refresh`.
 */

export type ReturnState = 'done' | 'refresh';

export interface ReturnPage {
  location: string;
  message: string;
}

export function returnPage(state: string | null): ReturnPage {
  if (state === 'done') {
    return {
      location: 'walltoall://financeiro?onboarding=done',
      message: 'Cadastro enviado. Volte para o app Wall to All para ver seus recebimentos.',
    };
  }
  return {
    location: 'walltoall://financeiro?onboarding=refresh',
    message:
      'Este link expirou. Volte para o app Wall to All e toque em "Ativar recebimentos" para continuar.',
  };
}
