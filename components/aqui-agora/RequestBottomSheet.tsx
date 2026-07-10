import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { QueueTicket } from '../../lib/services/types';
import { colors } from '../../lib/theme';
import { FuraFilaIcon } from '../icons/FuraFilaIcon';

export interface RequestBottomSheetProps {
  visible: boolean;
  /** Cliente da solicitação recebida (de lib/services/types). */
  ticket: QueueTicket | null;
  /** Aceitar o serviço — o pai fecha o sheet; o cliente permanece na fila. */
  onAccept: () => void;
  /** Recusar — o pai fecha o sheet e remove o cliente da fila (no_show). */
  onReject: () => void;
}

/**
 * Iniciais DECORATIVAS para o avatar da solicitação (o domínio não expõe
 * foto/avatar). "João Pedro" → "JP"; "Você" → "V". NÃO buscamos imagens remotas
 * (nem os assets do Figma) — o avatar é um círculo de iniciais.
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Cartões de relacionamento DECORATIVOS (o domínio da fila não modela avaliação,
 * tempo de casa nem última visita do cliente). Espelham o frame do Figma.
 */
const STATS: ReadonlyArray<{ label: string; value: string; caption: string }> = [
  { label: 'Avaliação', value: '4.9 ★', caption: '32 atendim.' },
  { label: 'Cliente desde', value: 'Mai 25', caption: '1 ano' },
  { label: 'Última visita', value: '12 dias', caption: 'Barba e Cabelo' },
];

/**
 * Bottom sheet de "Solicitação recebida" do lojista no Aqui e Agora (Figma node
 * 2511:486). Aparece quando um NOVO cliente entra na fila do lojista (a home
 * detecta a chegada pela assinatura da fila e abre este sheet).
 *
 * SPLIT domínio × decorativo: o QueueTicket só modela `customerName` (nome +
 * iniciais do avatar) e `isFuraFila` (etiqueta "Furou fila"). TODO o resto do
 * sheet — distância, serviço solicitado, valor a receber, endereço, mensagem do
 * cliente, estatísticas de relacionamento e o cronômetro "Responda em 00:48" —
 * é DECORATIVO/estático: o domínio da fila não modela nenhum desses campos. Cada
 * bloco decorativo está comentado como tal.
 *
 * Estrutura de apresentação espelha o PaymentCardBottomSheet: RN Modal
 * (transparent + animationType="slide"), backdrop escurecido (Pressable) e um
 * container preso ao rodapé com cantos superiores arredondados e um grabber.
 *
 * DISPENSAR = RECUSAR: tanto o toque no backdrop quanto o botão físico "voltar"
 * do Android (onRequestClose) chamam `onReject` — dispensar a solicitação é
 * declinar. Os dois botões explícitos ("Aceitar serviço"/"Recusar") são as ações
 * primárias.
 */
export const RequestBottomSheet: React.FC<RequestBottomSheetProps> = ({
  visible,
  ticket,
  onAccept,
  onReject,
}) => {
  const isOpen = visible && ticket !== null;

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onReject}>
      {/* Guarda dupla: sem ticket (ou fechado) não renderiza o corpo — evita
          desreferenciar um ticket nulo e nada aparece quando invisível. */}
      {visible && ticket ? (
        <View style={styles.root}>
          <Pressable
            testID="request-sheet-backdrop"
            accessibilityRole="button"
            accessibilityLabel="Fechar e recusar solicitação"
            style={styles.backdrop}
            onPress={onReject}
          />
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.handle} />

            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* ── client-row: avatar de iniciais + nome (+ etiqueta fura-fila) e
                  a distância decorativa à direita. ─────────────────────────── */}
              <View style={styles.clientRow}>
                <View style={styles.avatar} importantForAccessibility="no-hide-descendants">
                  {/* Avatar DECORATIVO de iniciais (o domínio não expõe foto). Oculto
                      ao leitor de tela — as iniciais só duplicam o nome. */}
                  <Text style={styles.avatarText}>{getInitials(ticket.customerName)}</Text>
                </View>
                <View
                  style={styles.clientInfo}
                  accessible
                  accessibilityLabel={`Solicitação de ${ticket.customerName}${
                    ticket.isFuraFila ? ', furou a fila' : ''
                  }`}
                >
                  <Text style={styles.clientName} numberOfLines={1}>
                    {ticket.customerName}
                  </Text>
                  {ticket.isFuraFila ? (
                    <View style={styles.furaTag}>
                      <FuraFilaIcon width={14} height={14} color={colors.contentWarning} />
                      <Text style={styles.furaTagText}>Furou fila</Text>
                    </View>
                  ) : null}
                </View>
                {/* Distância DECORATIVA (o QueueTicket não modela distância). */}
                <View style={styles.distance}>
                  <Text style={styles.distanceValue}>450m</Text>
                  <Text style={styles.distanceCaption}>de você</Text>
                </View>
              </View>

              {/* ── sv-card: SERVIÇO SOLICITADO — 100% DECORATIVO (o domínio não
                  modela serviço, preço, duração nem endereço). ─────────────── */}
              <View style={styles.svCard}>
                <Text style={styles.svLabel}>SERVIÇO SOLICITADO</Text>
                <View style={styles.svRow}>
                  <View style={styles.svInfo}>
                    <Text style={styles.svName}>Corte de cabelo Masculino</Text>
                    <Text style={styles.svDuration}>Aprox. 90 minutos</Text>
                  </View>
                  <View style={styles.svValueBlock}>
                    <Text style={styles.svValue}>R$ 65</Text>
                    <Text style={styles.svValueCaption}>a receber</Text>
                  </View>
                </View>
                <Text style={styles.svAddress}>
                  Rua Vergueiro, 1234 — Centro - 5 min de distância
                </Text>
              </View>

              {/* ── notes-card: mensagem do cliente — DECORATIVA (o domínio não
                  modela mensagem). ─────────────────────────────────────────── */}
              <View style={styles.notesCard}>
                <Text style={styles.notesLabel}>Mensagem do cliente:</Text>
                <Text style={styles.notesQuote}>
                  To precisando dar um trato no cabelo, e se for rápido eu consigo fechar também uma
                  barba.
                </Text>
              </View>

              {/* ── stats: 3 cartões de relacionamento — DECORATIVOS (o domínio
                  não expõe histórico/avaliação do cliente). ────────────────── */}
              <View style={styles.statsRow}>
                {STATS.map((stat) => (
                  <View key={stat.label} style={styles.statCard}>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statCaption}>{stat.caption}</Text>
                  </View>
                ))}
              </View>

              {/* ── acts: as duas ações primárias (ligadas ao domínio via o pai). */}
              <View style={styles.acts}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Aceitar serviço"
                  testID="btn-accept"
                  style={styles.acceptButton}
                  onPress={onAccept}
                >
                  <Text style={styles.acceptButtonText}>Aceitar serviço</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Recusar solicitação"
                  testID="btn-reject"
                  style={styles.rejectButton}
                  onPress={onReject}
                >
                  <Text style={styles.rejectButtonText}>Recusar</Text>
                </Pressable>
              </View>

              {/* ── countdown: "Responda em 00:48" — o "00:48" é ESTÁTICO
                  DECORATIVO (sem timer ao vivo, de propósito). ─────────────── */}
              <View style={styles.countdown}>
                <Text style={styles.countdownClock}>⏱</Text>
                <Text style={styles.countdownLabel}>Responda em</Text>
                <Text style={styles.countdownValue}>00:48</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
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
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceGrey,
    alignSelf: 'center',
    marginBottom: 16,
  },
  content: {
    rowGap: 16,
    paddingBottom: 8,
  },
  // ── client-row ───────────────────────────────────────────
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfacePrimaryExtraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: colors.brand,
  },
  clientInfo: {
    flex: 1,
    rowGap: 4,
  },
  clientName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  furaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    columnGap: 4,
    backgroundColor: colors.surfaceWarningLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  furaTagText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: colors.contentWarning,
  },
  distance: {
    alignItems: 'flex-end',
  },
  distanceValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  distanceCaption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  // ── sv-card ──────────────────────────────────────────────
  svCard: {
    backgroundColor: colors.surfacePrimaryExtraLight,
    borderRadius: 16,
    padding: 16,
    rowGap: 12,
  },
  svLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.accent,
  },
  svRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  svInfo: {
    flex: 1,
    rowGap: 2,
  },
  svName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  svDuration: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  svValueBlock: {
    alignItems: 'flex-end',
  },
  svValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.brand,
  },
  svValueCaption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 8,
    color: colors.textSecondary,
  },
  svAddress: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  // ── notes-card ───────────────────────────────────────────
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: 12,
    rowGap: 4,
  },
  notesLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.brand,
  },
  notesQuote: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textPrimary,
  },
  // ── stats ────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    columnGap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: 12,
    rowGap: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  statLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  statCaption: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 8,
    color: colors.textSecondary,
  },
  // ── acts ─────────────────────────────────────────────────
  acts: {
    rowGap: 12,
  },
  acceptButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  rejectButton: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  // ── countdown ────────────────────────────────────────────
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  countdownClock: {
    fontSize: 14,
    color: colors.contentWarning,
  },
  countdownLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  countdownValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentInfo,
  },
});
