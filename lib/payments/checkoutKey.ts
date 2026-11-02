/**
 * Chave de idempotência de uma tentativa de checkout (fura-fila): gerada ao
 * abrir o checkout e reaproveitada em retries e trocas de método, para que a
 * mesma tentativa nunca vire duas cobranças. No agendamento a chave é
 * `booking:{appointmentId}`.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function newCheckoutKey(): string {
  const bytes = new Uint8Array(20);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `chk_${out}`;
}
