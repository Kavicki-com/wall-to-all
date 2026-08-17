// F4 (QI): dados 100% do QiService mock; a unificação com o backend é F-futuro.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isToday, parseISO } from 'date-fns';
import { useQiService } from '../../context/ServicesContext';
import { useToast } from '../ui/ToastProvider';
import { Icon } from '../ui/Icon';
import { QiStatementList } from './QiStatementList';
import { handleError } from '../../lib/errorHandler';
import { formatBRL, getInitials } from '../../lib/formatters';
import { colors } from '../../lib/theme';
import type { QiIndicacao, QiSide, QiStatementEntry } from '../../lib/services/types';

export interface QiIndicacaoDetailsProps {
  /** Lado do programa: seleciona as fixtures do QiService (cliente/lojista). */
  side: QiSide;
  /** Id da indicação, vindo do `[id]` da rota. */
  id: string;
}

// ── Copy do Figma (cliente 2628:7149 · lojista 2606:5546) ──────────────────
// Os dois lados são espelhos EXATOS de copy (conferidos node a node): nenhum
// rótulo desta tela precisou virar prop, ao contrário da tela-mãe do QI.
const STAT_EARNED_LABEL = 'Você ganhou'; // 2628:7157 · 2606:5554
const STAT_STATUS_LABEL = 'Status da conta'; // 2628:7160 · 2606:5560
const STAT_APPOINTMENTS_LABEL = 'Agendamentos'; // 2628:7163 · 2606:5557
const STATUS_ACTIVE = 'Ativa'; // 2628:7159 · 2606:5559
const INFO_TITLE = 'Informações'; // 2628:7167 · 2606:5563
const INFO_INDICATED_AT_LABEL = 'Indicada em'; // 2628:7169 · 2606:5565
const INFO_FIRST_APPOINTMENT_LABEL = 'Primeiro agendamento'; // 2628:7172 · 2606:5568
const INFO_LAST_ACTIVITY_LABEL = 'Última atividade'; // 2628:7175 · 2606:5571
const TODAY_LABEL = 'Hoje'; // 2628:7176 · 2606:5572
const STATEMENT_TITLE = 'Extrato'; // 2628:7180 · 2606:6690

/* DIVERGÊNCIA deliberada do Figma (documentada p/ o revisor):
   1. TOP BAR. Os dois nodes do Figma ABREM com a top bar navy do app
      (2628:7150 · 2606:6576), cujo único controle é o menu do AppDrawer, e ela
      NÃO é renderizada aqui. A omissão é deliberada e segue o modelo de
      navegação do app: a top bar com o menu (HomeTopBar) é das telas-hub;
      sub-telas empurradas na pilha, como esta, usam o "Voltar" fantasma como
      afordância de saída, e ele aparece em TODOS os estados. O precedente está
      documentado em `components/wallet/PixKeyForm.tsx:162` ("Sub-tela
      navegável: usa o 'Voltar' fantasma [...], sem a top bar navy do Figma").
      A estrutura que a especificação da Task 11 descreve para esta tela começa
      no hero e não cita top bar, ao contrário da Task 8, que lista a
      `HomeTopBar` explicitamente para a tela-hub do QI. Sem ela, o hero passa a
      ser o topo e respeita o inset superior (useSafeAreaInsets).
   2. STATUS "Inativa". O Figma só desenha a indicação ativa (2628:7159). O tipo
      `QiIndicacao['status']` tem 'inactive' e a fixture o exercita (Ricardo
      Melo), então o rótulo negativo é decisão nossa, no feminino do próprio
      Figma ("Indicada em" / "Ativa"). O verde de destaque fica só no "Ativa":
      no estado inativo o valor volta ao branco neutro.
   3. DATAS AUSENTES. `firstAppointmentAt` e `lastActivityAt` são `string | null`
      no tipo (null em quem nunca agendou). O Figma não desenha esse caso; usamos
      "Sem registro", neutro em gênero, para servir aos dois rótulos.
   4. EXTRATO VAZIO. O `QiStatementList` (Task 7) não tem estado vazio próprio
      (contrato do JSDoc: o chamador só o renderiza quando há lançamentos) e o
      Figma não desenha a seção vazia. Sem uma mensagem, a seção "Extrato"
      ficaria com um título solto e ar de tela quebrada, então esta tela mostra
      uma linha de vazio própria. */
const STATUS_INACTIVE = 'Inativa';
const EMPTY_DATE = 'Sem registro';
const STATEMENT_EMPTY_MESSAGE = 'Nenhum lançamento por enquanto.';

/** Toast do id inexistente/carga falha (a tela volta em seguida). */
const LOAD_ERROR_MESSAGE = 'Não foi possível carregar esta indicação.';
/** Corpo do estado sem dados (texto distinto do toast, de propósito). */
const NOT_FOUND_MESSAGE = 'Indicação não encontrada.';

/**
 * Formata uma data do card "Informações": "Hoje" no dia corrente, senão
 * "dd/MM/yyyy"; null (nunca agendou / sem atividade) vira "Sem registro".
 * "Hoje" é derivado via date-fns (`isToday`), nunca por comparação manual com
 * `new Date()`. Devolve também o flag `today` porque o Figma pinta o valor de
 * verde nesse caso (2628:7176).
 */
function formatInfoDate(iso: string | null): { text: string; today: boolean } {
  if (iso === null) {
    return { text: EMPTY_DATE, today: false };
  }
  const date = parseISO(iso);
  return isToday(date)
    ? { text: TODAY_LABEL, today: true }
    : { text: format(date, 'dd/MM/yyyy'), today: false };
}

/** Linha rótulo/valor do card "Informações" (2628:7168, 7171, 7174). */
const InfoRow: React.FC<{ label: string; iso: string | null; testID: string }> = ({
  label,
  iso,
  testID,
}) => {
  const { text, today } = formatInfoDate(iso);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text testID={testID} style={[styles.infoValue, today && styles.infoValueToday]}>
        {text}
      </Text>
    </View>
  );
};

/**
 * Detalhes de UMA indicação do QI (F4, Task 11), COMPARTILHADA pelos dois lados
 * do app: as rotas `app/(client)/qi/indicacao/[id].tsx` e
 * `app/(merchant)/qi/indicacao/[id].tsx` são finas e só injetam o lado e o id
 * lido da rota. Figma 2628:7149 (cliente) e 2606:5546 (lojista), espelhos
 * exatos, inclusive de copy.
 *
 * Hero navy com o avatar (foto ou iniciais) e o nome, seguido de 3 stats:
 * "Você ganhou" (verde), "Status da conta" ("Ativa"/"Inativa") e
 * "Agendamentos". Abaixo, o "Voltar" fantasma, o card "Informações" (Indicada
 * em / Primeiro agendamento / Última atividade) e a seção "Extrato", cuja
 * timeline vive no QiStatementList.
 *
 * Carrega indicação + extrato EM PARALELO num `useEffect` com guarda `active`.
 * Aqui NÃO se usa `useFocusEffect` (ao contrário da tela-mãe do QI): o detalhe é
 * um registro estático endereçado por id, sem sub-telas que o alterem, então
 * recarregar a cada refoco só custaria requisições. Falha de carga (id
 * inexistente, que o serviço rejeita) mostra um toast de erro e volta pela
 * pilha; enquanto a tela ainda estiver montada, o corpo cai no estado "não
 * encontrada". Tanto o estado de carga quanto o de erro preservam o "Voltar":
 * o usuário sempre tem como sair da tela.
 */
export const QiIndicacaoDetails: React.FC<QiIndicacaoDetailsProps> = ({ side, id }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qiService = useQiService();
  const { showError } = useToast();

  const [loaded, setLoaded] = useState(false);
  const [indicacao, setIndicacao] = useState<QiIndicacao | null>(null);
  const [entries, setEntries] = useState<QiStatementEntry[]>([]);

  // Carga única por (serviço, lado, id). A guarda `active` descarta a escrita de
  // uma carga superada (troca de id) ou de uma tela já desmontada. O `catch` é
  // obrigatório: sem ele a rejeição do id inexistente escaparia como unhandled
  // rejection e a tela ficaria presa no spinner.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [indicacaoResult, statementResult] = await Promise.all([
          qiService.getIndicacao(side, id),
          qiService.getIndicacaoStatement(side, id),
        ]);
        if (!active) return;
        setIndicacao(indicacaoResult);
        setEntries(statementResult);
      } catch (error) {
        handleError(error, 'general');
        if (!active) return;
        // Erro definido pela especificação: avisa e devolve o usuário à lista.
        // Não há o que retentar num id que não existe.
        // TODO(F8): o `Promise.all` acima junta as DUAS leituras num único
        // catch, então uma falha só do EXTRATO ejetaria o usuário de uma tela
        // válida com a mensagem de indicação inexistente. Hoje isso é
        // INALCANÇÁVEL: as duas leituras só rejeitam para id desconhecido e
        // recebem o mesmo id, logo ou as duas falham ou nenhuma. Com backend
        // real é preciso (a) separar as falhas e ejetar apenas quando
        // `getIndicacao` rejeitar, e (b) definir o que a seção "Extrato" mostra
        // quando só ela falha: um estado próprio de "não foi possível carregar
        // o extrato", distinto do vazio (dizer "nenhum lançamento" quando não
        // se sabe seria mentira). Nenhum dos dois está desenhado no Figma nem
        // definido na especificação, por isso o comportamento fica como está.
        showError(LOAD_ERROR_MESSAGE);
        router.back();
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [qiService, side, id, router, showError]);

  // "Voltar" fantasma, declarado uma vez e reusado pelos três estados (só um
  // deles renderiza por vez, então o testID continua único).
  const backButton = (
    <Pressable
      testID="btn-back"
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      onPress={() => router.back()}
      style={styles.backButton}
    >
      <Icon name="chevron-left" size={24} color={colors.brand} />
      <Text style={styles.backText}>Voltar</Text>
    </Pressable>
  );

  // Nos estados NÃO carregados o hero (que absorve o inset) não existe, e sem
  // top bar o corpo é o topo da tela: sem este compensador o "Voltar", única
  // saída desses estados, ficaria sob a status bar num aparelho com notch.
  // Mesma solução da tela irmã "Como funciona".
  const topPadding = { paddingTop: insets.top + 20 };

  if (!loaded) {
    return (
      <View style={styles.root}>
        <View style={[styles.stateBody, topPadding]}>
          {backButton}
          <View style={styles.stateCenter}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        </View>
      </View>
    );
  }

  if (!indicacao) {
    // Carga falhou: o toast já avisou e o `router.back()` já foi disparado, mas
    // enquanto a tela existir ela precisa mostrar algo com saída própria.
    return (
      <View style={styles.root}>
        <View style={[styles.stateBody, topPadding]}>
          {backButton}
          <View style={styles.stateCenter}>
            <Text style={styles.errorText}>{NOT_FOUND_MESSAGE}</Text>
          </View>
        </View>
      </View>
    );
  }

  const isActive = indicacao.status === 'active';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero navy (2628:7152): avatar + nome e os 3 stats. Sem top bar, ele
            é o topo da tela e absorve o inset superior. */}
        <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          <View style={styles.identity}>
            {indicacao.avatarUrl ? (
              <Image
                testID="qi-detail-avatar"
                source={{ uri: indicacao.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarInitials]}>
                <Text style={styles.initials}>{getInitials(indicacao.name)}</Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {indicacao.name}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text testID="qi-detail-earned" style={[styles.statValue, styles.statValueSuccess]}>
                {formatBRL(indicacao.earnedCents)}
              </Text>
              <Text style={styles.statLabel}>{STAT_EARNED_LABEL}</Text>
            </View>
            <View style={styles.stat}>
              <Text
                testID="qi-detail-status"
                style={[styles.statValue, isActive && styles.statValueSuccess]}
              >
                {isActive ? STATUS_ACTIVE : STATUS_INACTIVE}
              </Text>
              <Text style={styles.statLabel}>{STAT_STATUS_LABEL}</Text>
            </View>
            <View style={styles.stat}>
              <Text testID="qi-detail-appointments" style={styles.statValue}>
                {indicacao.appointmentsCount}
              </Text>
              <Text style={styles.statLabel}>{STAT_APPOINTMENTS_LABEL}</Text>
            </View>
          </View>
        </View>

        {/* Corpo com padding próprio (o hero sangra até as bordas). */}
        <View style={styles.body}>
          {backButton}

          {/* Card "Informações" (2628:7166). */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{INFO_TITLE}</Text>
            <InfoRow
              label={INFO_INDICATED_AT_LABEL}
              iso={indicacao.indicatedAt}
              testID="qi-info-indicated-at"
            />
            <InfoRow
              label={INFO_FIRST_APPOINTMENT_LABEL}
              iso={indicacao.firstAppointmentAt}
              testID="qi-info-first-appointment"
            />
            <InfoRow
              label={INFO_LAST_ACTIVITY_LABEL}
              iso={indicacao.lastActivityAt}
              testID="qi-info-last-activity"
            />
          </View>

          {/* Seção "Extrato" (2628:7177): timeline do QiStatementList. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{STATEMENT_TITLE}</Text>
            {entries.length > 0 ? (
              <QiStatementList entries={entries} testID="qi-statement-list" />
            ) : (
              <Text testID="qi-statement-empty" style={styles.statementEmpty}>
                {STATEMENT_EMPTY_MESSAGE}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const AVATAR_SIZE = 40;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // ── Estados de carga e de erro (com o "Voltar") ────────────
  stateBody: {
    // O paddingTop NÃO mora aqui: ele soma o inset superior e é aplicado em
    // linha (topPadding), já que estes estados não têm hero nem top bar acima.
    flex: 1,
    paddingHorizontal: 20, // Figma padding/ml (igual ao corpo carregado)
  },
  stateCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 40, // respiro sob a tab bar flutuante
  },
  // ── Hero navy (2628:7152) ──────────────────────────────────
  hero: {
    backgroundColor: colors.brand,
    borderBottomLeftRadius: 24, // Figma border/radius/l
    borderBottomRightRadius: 24,
    paddingHorizontal: 24, // Figma padding/l
    paddingBottom: 24,
    rowGap: 16, // Figma gap/m
  },
  identity: {
    // Alinhada à ESQUERDA como no Figma: o `avatar-friend` começa em x=24
    // (2628:7153 · 2606:6571), colado na margem do hero, com o nome à direita.
    // A `stats-row` logo abaixo é que centraliza, mas por outro motivo (3
    // colunas de largura igual), então ela NÃO herda este alinhamento.
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8, // Figma gap/s
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarInitials: {
    // Sobre o navy do hero as iniciais invertem o par usado na lista de
    // indicados (círculo claro, texto navy) para manter o contraste.
    backgroundColor: colors.contentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.brand,
  },
  name: {
    flexShrink: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  statsRow: {
    flexDirection: 'row',
    columnGap: 12, // Figma gap/sm
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    rowGap: 4, // Figma gap/xs
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20, // Figma font/size/ml
    color: colors.contentLight,
    textAlign: 'center',
  },
  statValueSuccess: {
    // Figma content/sucess-light (#A2ECC2), mesmo valor do token já existente
    // surfaceSuccessLight: não se cria token novo só por diferença de nome.
    color: colors.surfaceSuccessLight,
  },
  statLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentPrimaryLight,
    textAlign: 'center',
  },
  // ── Corpo ──────────────────────────────────────────────────
  body: {
    paddingHorizontal: 20, // Figma padding/ml
    paddingTop: 20,
    gap: 24, // Figma gap/l entre seções
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  // ── Card "Informações" (2628:7166) ─────────────────────────
  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceGrey, // Figma border/disable
    borderRadius: 16, // Figma border/radius/m
    padding: 16, // Figma padding/m
    rowGap: 12, // Figma gap/sm
  },
  infoTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  infoLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoValue: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  infoValueToday: {
    color: colors.surfaceSuccess, // Figma content/success no valor "Hoje"
  },
  // ── Seção "Extrato" (2628:7177) ────────────────────────────
  section: {
    gap: 16, // Figma gap/m dentro da seção
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  statementEmpty: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
});
