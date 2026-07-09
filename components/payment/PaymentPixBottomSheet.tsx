import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Svg, Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useWalletService } from '../../context/ServicesContext';
import type { PixCharge } from '../../lib/services/types';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';

export interface PaymentPixBottomSheetProps {
  visible: boolean;
  amountCents: number;
  description: string;
  /** Chamado quando o usuário confirma que pagou (o pai fecha o sheet + segue o fluxo). */
  onSuccess: () => void;
  /** Fecha o sheet (backdrop/arrasto). */
  onClose: () => void;
}

// Figma node 2663:7091 (versão nova) — bottom-sheet "Pagamento via PIX". O node
// mostra apenas o estado "Processando seu pagamento..."; o passo anterior (QR +
// copia-e-cola + CTA) segue o contrato da Task 17 e as convenções do DS.
const QR_MODULES = 21; // Malha do placeholder de QR (v1 clássico: 21×21 módulos).
const QR_SIZE = 176; // Lado do QR renderizado (px).
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

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
  onSuccess,
  onClose,
}) => {
  const wallet = useWalletService();
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Ao abrir, cria a cobrança Pix (mock). Reseta o estado transitório a cada
  // abertura; só busca quando visível (não desperdiça chamadas com o sheet fechado).
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setCharge(null);
    setCopied(false);
    setProcessing(false);
    wallet
      .createPixCharge(amountCents, description)
      .then((result) => {
        if (active) setCharge(result);
      })
      .catch(() => {
        // Falha ao criar a cobrança deixa o sheet no estado de carregamento;
        // fechar e reabrir tenta de novo (fluxo real detalha erros na F3).
      });
    return () => {
      active = false;
    };
  }, [visible, wallet, amountCents, description]);

  const handleCopy = useCallback(async () => {
    if (!charge) return;
    await Clipboard.setStringAsync(charge.copyPasteCode);
    setCopied(true);
  }, [charge]);

  const handleConfirm = useCallback(() => {
    // Reflete o estado "Processando..." do Figma e sinaliza sucesso ao pai (que
    // fecha o sheet e segue o fluxo — entra na fila e abre o modal de sucesso).
    setProcessing(true);
    onSuccess();
  }, [onSuccess]);

  if (!visible) return null;

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

          {processing ? (
            <View style={styles.processing}>
              <ActivityIndicator color={colors.brand} size="large" />
              <Text style={styles.processingText}>Processando seu pagamento...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.amountBlock}>
                <Text style={styles.amount}>{formatBRL(amountCents)}</Text>
                <Text style={styles.amountCaption}>Valor a pagar</Text>
              </View>

              {charge ? (
                <>
                  <QrPlaceholder code={charge.qrCode} />
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
                  {copied ? <Text style={styles.copiedHint}>Código copiado!</Text> : null}
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={HIT_SLOP}
                    style={styles.confirmButton}
                    onPress={handleConfirm}
                  >
                    <Text style={styles.confirmButtonText}>Já realizei o pagamento</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              )}
            </ScrollView>
          )}
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
  processing: {
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 16,
    paddingVertical: 48,
  },
  processingText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
