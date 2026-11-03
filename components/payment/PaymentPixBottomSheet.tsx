import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native';
import { Svg, Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useWalletService } from '../../context/ServicesContext';
import type { PaymentRequestContext, PixCharge } from '../../lib/services/types';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import { PaymentProcessingSheet } from './PaymentProcessingSheet';

export interface PaymentPixBottomSheetProps {
  visible: boolean;
  amountCents: number;
  description: string;
  /** F8: finalidade e chave da cobrança (obrigatório na carteira Stripe). */
  context?: PaymentRequestContext;
  /**
   * Pagamento confirmado pelo servidor (polling ou "Já realizei o pagamento").
   * Recebe o `paymentId` da cobrança (ausente só numa cobrança sem id).
   */
  onSuccess: (paymentId?: string) => void;
  /** Intervalo do polling do status enquanto o sheet está aberto. Default 2 s. */
  pollIntervalMs?: number;
  /** Fecha o sheet (backdrop/arrasto). */
  onClose: () => void;
}

// Figma node 2663:7091 (versão nova) — bottom-sheet "Pagamento via PIX". O node
// mostra apenas o estado "Processando seu pagamento..."; o passo anterior (QR +
// copia-e-cola + CTA) segue o contrato da Task 17 e as convenções do DS.
const QR_MODULES = 21; // Malha do placeholder de QR (v1 clássico: 21×21 módulos).
const QR_SIZE = 176; // Lado do QR renderizado (px).
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
// Duração do estado "Processando..." (node 2663:9149) antes de sinalizar sucesso.
const PROCESSING_MS = 600;
const DEFAULT_POLL_MS = 2000;

/**
 * Constrói uma matriz booleana determinística a partir do payload (copia-e-cola)
 * para desenhar um PLACEHOLDER de QR — NÃO é um QR escaneável (o repo não tem
 * lib de QR e a Task 17 proíbe adicionar dependência). Semeia um PRNG
 * (mulberry32) com os char codes do payload e carimba os três padrões
 * localizadores nos cantos para dar cara de QR.
 */
function buildQrMatrix(seed: string): boolean[][] {
  const size = QR_MODULES;
  let state = 0;
  for (let i = 0; i < seed.length; i += 1) {
    state = (state + seed.charCodeAt(i) * (i + 1)) >>> 0;
  }
  const rand = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const matrix: boolean[][] = [];
  for (let r = 0; r < size; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c += 1) {
      row.push(rand() > 0.5);
    }
    matrix.push(row);
  }

  // Padrão localizador 7×7 (borda + núcleo 3×3) nos cantos superiores e inferior-esq.
  const stamp = (r0: number, c0: number): void => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[r0 + r][c0 + c] = border || core;
      }
    }
  };
  stamp(0, 0);
  stamp(0, size - 7);
  stamp(size - 7, 0);
  return matrix;
}

/** Placeholder de QR (react-native-svg) — malha derivada do payload. */
const QrPlaceholder: React.FC<{ code: string }> = ({ code }) => {
  const matrix = useMemo(() => buildQrMatrix(code), [code]);
  return (
    <View style={styles.qrBox}>
      <Svg
        width={QR_SIZE}
        height={QR_SIZE}
        viewBox={`0 0 ${QR_MODULES} ${QR_MODULES}`}
        accessibilityRole="image"
        accessibilityLabel="QR Code do pagamento Pix"
      >
        {matrix.flatMap((row, r) =>
          row.map((filled, c) =>
            filled ? (
              <Rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={colors.brand} />
            ) : null,
          ),
        )}
      </Svg>
    </View>
  );
};

export const PaymentPixBottomSheet: React.FC<PaymentPixBottomSheetProps> = ({
  visible,
  amountCents,
  description,
  context,
  onSuccess,
  onClose,
  pollIntervalMs = DEFAULT_POLL_MS,
}) => {
  const wallet = useWalletService();
  // O pai recria o objeto a cada render: a cobrança só é refeita quando a
  // chave muda; o contexto mais recente vem pela ref.
  const contextRef = useRef(context);
  contextRef.current = context;
  const contextKey = context?.idempotencyKey;
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);
  // Ref para o onSuccess mais recente (o timeout do "Processando..." dispara mais
  // tarde; sem ref capturaria um onSuccess velho). Timeout guardado p/ cancelar.
  const onSuccessRef = useRef(onSuccess);
  const processingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Conclui uma vez só (polling e o botão podem achar o pagamento juntos).
  const finishedRef = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // Ao abrir, cria (ou retoma, mesma chave) a cobrança Pix. Reseta o estado
  // transitório a cada abertura; só busca quando visível.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    finishedRef.current = false;
    setCharge(null);
    setCopied(false);
    setProcessing(false);
    setNotYet(false);
    wallet
      .createPixCharge(amountCents, description, contextRef.current)
      .then((result) => {
        if (active) setCharge(result);
      })
      .catch(() => {
        // Falha ao criar a cobrança deixa o sheet no estado de carregamento;
        // fechar e reabrir tenta de novo.
      });
    return () => {
      active = false;
      // Fechar antes do fim do "Processando..." não conclui o pagamento.
      if (processingTimeout.current) {
        clearTimeout(processingTimeout.current);
        processingTimeout.current = null;
      }
    };
  }, [visible, wallet, amountCents, description, contextKey]);

  /** Mostra o "Processando..." compartilhado e só então avisa o pai. */
  const finish = useCallback((paymentId?: string) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setProcessing(true);
    processingTimeout.current = setTimeout(() => {
      onSuccessRef.current(paymentId);
    }, PROCESSING_MS);
  }, []);

  // Enquanto aberto, consulta o status no servidor (o webhook grava o pago).
  // A primeira consulta espera um intervalo: o QR precisa ficar na tela.
  const paymentId = charge?.paymentId;
  useEffect(() => {
    if (!visible || !paymentId) return;
    let active = true;
    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight || finishedRef.current) return;
      inFlight = true;
      wallet
        .getPaymentStatus(paymentId)
        .then((status) => {
          if (active && status === 'succeeded') finish(paymentId);
        })
        .catch(() => {
          // Rede instável: a próxima consulta decide.
        })
        .finally(() => {
          inFlight = false;
        });
    }, pollIntervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [visible, paymentId, wallet, pollIntervalMs, finish]);

  const handleCopy = useCallback(async () => {
    if (!charge) return;
    await Clipboard.setStringAsync(charge.copyPasteCode);
    setCopied(true);
  }, [charge]);

  // "Já realizei o pagamento" força uma consulta; nunca conclui sem o servidor.
  const handleConfirm = useCallback(async () => {
    if (!charge || checking) return;
    const id = charge.paymentId;
    if (!id) {
      // Cobrança sem id (contrato antigo): não há o que consultar.
      finish();
      return;
    }
    setChecking(true);
    setNotYet(false);
    try {
      const status = await wallet.getPaymentStatus(id);
      if (!visibleRef.current) return;
      if (status === 'succeeded') finish(id);
      else setNotYet(true);
    } catch {
      if (visibleRef.current) setNotYet(true);
    } finally {
      setChecking(false);
    }
  }, [charge, checking, wallet, finish]);

  if (!visible) return null;

  if (processing) return <PaymentProcessingSheet visible />;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          testID="pix-sheet-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            Pagamento via PIX
          </Text>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.amountBlock}>
              <Text style={styles.amount}>{formatBRL(amountCents)}</Text>
              <Text style={styles.amountCaption}>Valor a pagar</Text>
            </View>

            {charge ? (
              <>
                {charge.qrImageUrl ? (
                  <View style={styles.qrBox}>
                    <Image
                      testID="pix-qr-image"
                      source={{ uri: charge.qrImageUrl }}
                      style={styles.qrImage}
                      accessibilityRole="image"
                      accessibilityLabel="QR Code do pagamento Pix"
                    />
                  </View>
                ) : (
                  <QrPlaceholder code={charge.qrCode} />
                )}
                <Text style={styles.instruction}>
                  Escaneie o QR Code no app do seu banco ou copie o código abaixo.
                </Text>
                <View style={styles.codeBox}>
                  <Text selectable style={styles.code}>
                    {charge.copyPasteCode}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Copiar código PIX"
                  hitSlop={HIT_SLOP}
                  style={styles.copyButton}
                  onPress={handleCopy}
                >
                  <Text style={styles.copyButtonText}>Copiar código PIX</Text>
                </Pressable>
                {copied ? (
                  <Text accessibilityLiveRegion="polite" style={styles.copiedHint}>
                    Código copiado!
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  hitSlop={HIT_SLOP}
                  style={styles.confirmButton}
                  onPress={() => void handleConfirm()}
                  disabled={checking}
                  accessibilityState={{ disabled: checking, busy: checking }}
                >
                  {checking ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.confirmButtonText}>Já realizei o pagamento</Text>
                  )}
                </Pressable>
                {notYet ? (
                  <Text accessibilityLiveRegion="polite" style={styles.notYetHint}>
                    Ainda não identificamos o pagamento
                  </Text>
                ) : null}
              </>
            ) : (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.brand} />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    rowGap: 16,
    alignItems: 'center',
    maxHeight: '90%',
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceGrey,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    rowGap: 16,
    paddingBottom: 8,
  },
  amountBlock: {
    alignItems: 'center',
    rowGap: 2,
  },
  amount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
  },
  amountCaption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  qrImage: {
    width: QR_SIZE,
    height: QR_SIZE,
  },
  notYetHint: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  qrBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.contentLightGrey,
    backgroundColor: colors.white,
  },
  instruction: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  codeBox: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    backgroundColor: colors.surface,
    padding: 12,
  },
  code: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  copyButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  copiedHint: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.surfaceSuccess,
  },
  confirmButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  loading: {
    paddingVertical: 40,
  },
});
