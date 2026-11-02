/**
 * `next_action.pix_display_qr_code` do PaymentIntent -> dados que o
 * `PaymentPixBottomSheet` exibe. Puro.
 */

export interface PixDisplay {
  /** Payload EMV (copia e cola); é também o conteúdo do QR. */
  copyPasteCode: string;
  /** PNG do QR gerado pela Stripe. */
  qrImageUrl: string | null;
  /** Página da Stripe com as instruções; em test mode tem a simulação do pagamento. */
  hostedInstructionsUrl: string | null;
  /** ISO 8601. */
  expiresAt: string;
}

interface PixNextActionShape {
  type?: string;
  pix_display_qr_code?: {
    data?: string | null;
    image_url_png?: string | null;
    hosted_instructions_url?: string | null;
    expires_at?: number | null;
  } | null;
}

export function isPixNextAction(nextAction: unknown): boolean {
  return (nextAction as PixNextActionShape | null)?.type === 'pix_display_qr_code';
}

export function parsePixNextAction(nextAction: unknown): PixDisplay {
  const action = nextAction as PixNextActionShape | null;
  const qr = action?.type === 'pix_display_qr_code' ? action.pix_display_qr_code : null;
  if (!qr?.data || typeof qr.expires_at !== 'number') {
    throw new Error('PaymentIntent sem next_action de Pix.');
  }
  return {
    copyPasteCode: qr.data,
    qrImageUrl: qr.image_url_png ?? null,
    hostedInstructionsUrl: qr.hosted_instructions_url ?? null,
    expiresAt: new Date(qr.expires_at * 1000).toISOString(),
  };
}
