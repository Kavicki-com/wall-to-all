/** Usuário dono do JWT da requisição (o gateway já validou a assinatura). */

import { adminClient } from './admin.ts';
import { HttpError } from './http.ts';

export interface Caller {
  id: string;
  email: string | null;
}

export async function requireUser(req: Request): Promise<Caller> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) throw new HttpError(401, 'unauthorized', 'Sem token.');

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'unauthorized', 'Sessão inválida.');
  return { id: data.user.id, email: data.user.email ?? null };
}
