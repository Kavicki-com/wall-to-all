/**
 * Edge Function `connect-return` (deploy com `--no-verify-jwt`): `return_url`
 * e `refresh_url` do Account Link. Redireciona para o deep link do app; não lê
 * nem grava nada (o estado da conta vem do webhook e do `sync`).
 */

import { returnPage } from '../_shared/returnPage.ts';

Deno.serve((req) => {
  if (req.method !== 'GET') {
    return new Response('method not allowed', { status: 405 });
  }
  const state = new URL(req.url).searchParams.get('state');
  const page = returnPage(state);
  return new Response(page.message, {
    status: 302,
    headers: {
      Location: page.location,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
