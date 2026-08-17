// F4 (QI): dados 100% do QiService mock; a unificação com o backend é F-futuro.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQiService } from '../../context/ServicesContext';
import { Icon } from '../ui/Icon';
import { buildQiShareMessage, QI_INVITE_URL } from '../../lib/qi/shareMessage';
import { handleError } from '../../lib/errorHandler';
import { formatBRL } from '../../lib/formatters';
import { colors } from '../../lib/theme';
import type { QiProgramRules, QiSide } from '../../lib/services/types';

export interface QiHowItWorksProps {
  /** Lado do programa: seleciona as fixtures do QiService (cliente/lojista). */
  side: QiSide;
}

// ── Copy do Figma (cliente 2628:7226 · lojista 2606:5632) ──────────────────
// Os dois lados são espelhos EXATOS de copy (conferidos node a node, inclusive
// os 3 passos, as 3 linhas de ganho e as 4 regras): nenhum rótulo desta tela
// precisou virar prop, ao contrário da tela-mãe do QI. Mesma constatação da
// tela irmã de detalhes da indicação.
const HEADER_BADGE = '$'; // 2628:7238 · 2606:6385
const HEADER_TITLE = 'Programa QI'; // 2628:7239 · 2606:6386
const HEADER_SUBTITLE = 'Cashback ilimitado por indicação'; // 2628:7240 · 2606:6387

const EARN_SECTION_TITLE = 'Quanto você ganha?'; // 2628:7259 · 2606:5660
const RULES_SECTION_TITLE = 'Regras de participação'; // 2628:7282 · 2606:5683

const SHARE_CTA_LABEL = 'Compartilhar meu código'; // 2628:7296 · 2606:5701
const REGULATION_LABEL = 'Ver o regulamento completo'; // 2628:7297 · 2606:6165

/** Os 3 passos numerados (cards step-1/2/3 do Figma). */
const STEPS: ReadonlyArray<{ title: string; description: string }> = [
  {
    // 2628:7245 / 2628:7246 · 2606:5646 / 2606:5647
    title: 'Compartilhe seu código',
    description: 'Convide amigos via Pix, WhatsApp ou link direto. Cada amigo vira sua indicação.',
  },
  {
    // 2628:7251 / 2628:7252 · 2606:5652 / 2606:5653
    title: 'Amigos viram clientes',
    description: 'Quando seus indicados agendam serviços, você ganha automaticamente.',
  },
  {
    // 2628:7257 / 2628:7258 · 2606:5658 / 2606:5659
    title: 'Receba via Pix',
    description: 'Saque seu cashback acumulado.',
  },
];

// Rótulos das 3 linhas do card "Quanto você ganha?" (os VALORES à direita saem
// das regras do programa, nunca literais aqui).
const EARN_PER_SERVICE_LABEL = 'Por serviço'; // 2628:7265 · 2606:5666
const EARN_PER_SERVICE_HINT = 'Cada agendamento do indicado'; // 2628:7266 · 2606:5667
const EARN_BONUS_LABEL = 'Bônus mensal'; // 2628:7272 · 2606:5673
const EARN_BONUS_HINT = 'Quando indicado se mantém ativo'; // 2628:7273 · 2606:5674
const EARN_TOP_LEVEL_LABEL = 'Nível Ouro'; // 2628:7279 · 2606:5680
// O limiar do nível Ouro NÃO existe em `QiProgramRules` (o tipo só traz o
// multiplicador), então esta dica segue literal, como no Figma.
const EARN_TOP_LEVEL_HINT = '10+ indicados ativos'; // 2628:7280 · 2606:5681

/** Glifos decorativos dos badges das linhas de ganho (copy do Figma, não assets). */
const EARN_PER_SERVICE_GLYPH = '%'; // 2628:7263 · 2606:5664
const EARN_BONUS_GLYPH = '★'; // 2628:7270 · 2606:5671
const EARN_TOP_LEVEL_GLYPH = '♔'; // 2628:7277 · 2606:5678

/** Quarta regra: única sem número, portanto literal do Figma. */
const RULE_UNLIMITED = 'Indicações ilimitadas'; // 2628:7295 · 2606:5700

/* DIVERGÊNCIA deliberada do Figma (documentada p/ o revisor):
   1. TOP BAR. Os dois nodes do Figma ABREM com a top bar navy do app
      (2628:7227 · 2606:5775), cujo único controle é o menu do AppDrawer, e ela
      NÃO é renderizada aqui. A omissão é deliberada e segue o modelo de
      navegação do app: a top bar com o menu (HomeTopBar) é das telas-hub;
      sub-telas empurradas na pilha, como esta, usam o "Voltar" fantasma como
      afordância de saída, e ele aparece em TODOS os estados. O precedente está
      documentado em `components/wallet/PixKeyForm.tsx:162` ("Sub-tela
      navegável: usa o 'Voltar' fantasma [...], sem a top bar navy do Figma").
      A estrutura que a especificação da Task 11 descreve para esta tela começa
      no cabeçalho "Programa QI" e não cita top bar, ao contrário da Task 8, que
      lista a `HomeTopBar` explicitamente para a tela-hub do QI. Sem ela, o
      corpo passa a ser o topo e respeita o inset superior (useSafeAreaInsets).
      MESMA decisão (e mesmo racional) da tela irmã de detalhes da indicação.
   2. REGRA DA TAXA. O Figma escreve "Saques ilimitados sem taxas" (2628:7292 ·
      2606:5696), o que CONTRADIZ as regras do serviço: `feeCents` é 500 e a
      isenção só vale a partir de `feeFreeThresholdCents` (R$ 200,00), a mesma
      régua que a cotação de saque aplica (computeWithdrawQuote). Prometer
      isenção total na tela de explicação e cobrar R$ 5,00 na de saque seria
      enganoso, então a linha é montada a partir das regras. A especificação da
      Task 11 pede exatamente isso ("mínimo/isenção/prazo formatados das
      rules").
   3. BÔNUS COM CENTAVOS. O Figma abrevia o bônus como "+R$ 5" (2628:7274 ·
      2606:5675); aqui ele sai de `formatBRL(monthlyBonusCents)` ("+R$ 5,00"),
      como todo valor monetário do app. Diferença só de grafia, e ela mantém a
      tela correta se o bônus deixar de ser um valor redondo.
   4. "Ver o regulamento completo" (decisão #9 do plano). O rótulo não tem tela
      alvo em lugar nenhum do Figma. Um Pressable com onPress vazio seria
      enganoso (o leitor de tela o anunciaria como botão e nada aconteceria),
      então ele é TEXTO estático até existir a tela do regulamento.
      TODO(F8): transformar em botão e navegar para o regulamento. */

/** Corpo do estado de erro (a tela sempre oferece o "Voltar" e o retry). */
const LOAD_ERROR_MESSAGE = 'Não foi possível carregar as regras do programa.';

/** Uma das 3 linhas do card "Quanto você ganha?" (2628:7261, 7268, 7275). */
const EarnRow: React.FC<{
  glyph: string;
  glyphStyle: object;
  badgeStyle: object;
  label: string;
  hint: string;
  value: string;
  testID: string;
}> = ({ glyph, glyphStyle, badgeStyle, label, hint, value, testID }) => (
  <View style={styles.earnRow}>
    {/* Badge puramente decorativo: escondido do leitor de tela para o rótulo
        da linha não vir precedido de "%", "estrela" ou "coroa". */}
    <View
      style={[styles.earnBadge, badgeStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.earnGlyph, glyphStyle]}>{glyph}</Text>
    </View>
    <View style={styles.earnInfo}>
      <Text style={styles.earnLabel}>{label}</Text>
      <Text style={styles.earnHint}>{hint}</Text>
    </View>
    <Text testID={testID} style={styles.earnValue}>
      {value}
    </Text>
  </View>
);

/** Uma regra de participação: check verde + texto (2628:7284, 7287, 7290, 7293). */
const RuleRow: React.FC<{ text: string; testID: string }> = ({ text, testID }) => (
  <View style={styles.ruleRow}>
    <Icon name="check-circle" size={16} color={colors.surfaceSuccess} />
    <Text testID={testID} style={styles.ruleText}>
      {text}
    </Text>
  </View>
);

/**
 * Tela "Como funciona o QI" (F4, Task 11), COMPARTILHADA pelos dois lados do
 * app: as rotas `app/(client)/qi/how-it-works.tsx` e
 * `app/(merchant)/qi/how-it-works.tsx` são finas e só injetam o lado. Figma
 * 2628:7226 (cliente) e 2606:5632 (lojista), espelhos exatos, inclusive de copy.
 *
 * Cabeçalho com o badge "$", "Programa QI" e o subtítulo; 3 passos numerados;
 * a seção "Quanto você ganha?", cujo card traz as 3 linhas montadas a partir de
 * `getProgramRules()`; a seção "Regras de participação" (checks verdes, também
 * formatados das regras); o CTA navy "Compartilhar meu código", que dispara o
 * `Share` com o MESMO texto da tela do QI (fonte única em `lib/qi/shareMessage`);
 * e, ao final, a nota estática "Ver o regulamento completo".
 *
 * Carrega regras + código EM PARALELO num `useEffect`. Aqui NÃO se usa
 * `useFocusEffect` (ao contrário da tela-mãe do QI): a explicação é conteúdo
 * estático, sem sub-telas que a alterem, então recarregar a cada refoco só
 * custaria requisições, mesma decisão da tela irmã de detalhes. Falha de carga
 * mostra um estado de erro com "Tentar novamente" em vez do toast-e-volta da
 * tela de detalhes: lá o erro é um id inexistente (não há o que retentar), aqui
 * é uma leitura genérica e transitória, então a tela se comporta como a
 * tela-mãe do QI. Tanto o estado de carga quanto o de erro preservam o
 * "Voltar": o usuário sempre tem como sair da tela.
 */
export const QiHowItWorks: React.FC<QiHowItWorksProps> = ({ side }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qiService = useQiService();

  const [loaded, setLoaded] = useState(false);
  // Recarga disparada pelo "Tentar novamente": desabilita o botão e mostra
  // progresso (sem isso, o botão parece morto e convida a toques repetidos,
  // cada um disparando uma carga nova). Mesmo padrão da tela-mãe do QI.
  const [reloading, setReloading] = useState(false);
  const [rules, setRules] = useState<QiProgramRules | null>(null);
  const [code, setCode] = useState('');

  // Token monotônico da carga corrente: como `load` também é chamada de FORA do
  // efeito (pelo retry), um flag preso ao ciclo do efeito não invalidaria essa
  // carga. Mesma solução da tela-mãe do QI.
  const runIdRef = useRef(0);

  const load = useCallback(async () => {
    const runId = ++runIdRef.current;
    try {
      const [rulesResult, codeResult] = await Promise.all([
        qiService.getProgramRules(),
        qiService.getQiCode(side),
      ]);
      if (runIdRef.current !== runId) return;
      setRules(rulesResult);
      setCode(codeResult);
    } catch (error) {
      // Sem este catch a rejeição escaparia como unhandled rejection. `rules`
      // segue nulo e o gate abaixo mostra o estado de erro (com "Tentar
      // novamente") em vez de prender o usuário no spinner.
      handleError(error, 'general');
    } finally {
      if (runIdRef.current === runId) {
        setLoaded(true);
        setReloading(false);
      }
    }
  }, [qiService, side]);

  // Carrega ao montar e sempre que `load` muda (serviço ou lado). Ao desmontar
  // (ou trocar de lado), o bump do token invalida a carga em voo.
  useEffect(() => {
    void load();
    return () => {
      // A regra sugere copiar `runIdRef.current` para dentro do efeito, mas é
      // exatamente o valor do MOMENTO DA LIMPEZA que interessa: copiá-lo na
      // montagem invalidaria o token errado quando um retry já tivesse
      // avançado o contador. O ref não aponta para nenhum nó renderizado.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- ver acima
      runIdRef.current++;
    };
  }, [load]);

  // "Tentar novamente" do estado de erro: mesma carga do efeito, sem estado
  // gatilho. Guarda contra duplo-toque (o botão também fica `disabled`).
  const handleRetry = useCallback(() => {
    if (reloading) return;
    setReloading(true);
    void load();
  }, [load, reloading]);

  // `await` + try/catch: sem eles, uma rejeição do share (cancelamento/erro no
  // Android) viraria unhandled rejection. Mesmo payload da tela do QI: além da
  // `message` (que já embute o link), o `url` separado, que no iOS deixa a
  // share sheet oferecer as ações de link.
  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: buildQiShareMessage(code), url: QI_INVITE_URL });
    } catch (error) {
      handleError(error, 'general');
    }
  }, [code]);

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

  // Sem top bar, o corpo é o topo da tela e absorve o inset superior.
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

  if (!rules) {
    return (
      <View style={styles.root}>
        <View style={[styles.stateBody, topPadding]}>
          {backButton}
          <View style={styles.stateCenter}>
            <Text style={styles.errorText}>{LOAD_ERROR_MESSAGE}</Text>
            <Pressable
              testID="btn-retry"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
              accessibilityState={{ disabled: reloading, busy: reloading }}
              disabled={reloading}
              onPress={handleRetry}
              style={[styles.retryButton, reloading && styles.retryButtonDisabled]}
            >
              {/* O rótulo não some durante a recarga (o botão não muda de
                  largura e o leitor de tela continua anunciando a ação): o
                  progresso vem do spinner ao lado, do esmaecimento e do
                  `disabled`. */}
              {reloading && <ActivityIndicator size="small" color={colors.contentLight} />}
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, topPadding]}
        showsVerticalScrollIndicator={false}
      >
        {backButton}

        {/* Cabeçalho (2628:7236): badge decorativo + título + subtítulo. */}
        <View style={styles.header}>
          <View
            style={styles.headerBadge}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.headerBadgeText}>{HEADER_BADGE}</Text>
          </View>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {HEADER_TITLE}
          </Text>
          <Text style={styles.headerSubtitle}>{HEADER_SUBTITLE}</Text>
        </View>

        {/* Os 3 passos numerados (2628:7241, 7247, 7253). */}
        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{String(index + 1)}</Text>
            </View>
            <View style={styles.stepInfo}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}

        {/* "Quanto você ganha?" (2628:7259) e o card das 3 linhas (2628:7260). */}
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {EARN_SECTION_TITLE}
        </Text>
        <View style={styles.earnCard}>
          <EarnRow
            glyph={EARN_PER_SERVICE_GLYPH}
            badgeStyle={styles.earnBadgeSuccess}
            glyphStyle={styles.earnGlyphSuccess}
            label={EARN_PER_SERVICE_LABEL}
            hint={EARN_PER_SERVICE_HINT}
            value={`${rules.perServicePct}%`}
            testID="qi-earn-per-service"
          />
          <EarnRow
            glyph={EARN_BONUS_GLYPH}
            badgeStyle={styles.earnBadgeWarning}
            glyphStyle={styles.earnGlyphWarning}
            label={EARN_BONUS_LABEL}
            hint={EARN_BONUS_HINT}
            value={`+${formatBRL(rules.monthlyBonusCents)}`}
            testID="qi-earn-monthly-bonus"
          />
          <EarnRow
            glyph={EARN_TOP_LEVEL_GLYPH}
            badgeStyle={styles.earnBadgeInfo}
            glyphStyle={styles.earnGlyphInfo}
            label={EARN_TOP_LEVEL_LABEL}
            hint={EARN_TOP_LEVEL_HINT}
            value={`x${rules.topLevelMultiplier} cashback`}
            testID="qi-earn-top-level"
          />
        </View>

        {/* "Regras de participação" (2628:7282) e os checks (2628:7283). */}
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {RULES_SECTION_TITLE}
        </Text>
        <View style={styles.rulesCard}>
          <RuleRow
            testID="qi-rule-credit-window"
            text={`Cashback creditado em até ${rules.creditWindowHours}h após o agendamento`}
          />
          <RuleRow
            testID="qi-rule-min-withdraw"
            text={`Saque mínimo ${formatBRL(rules.minWithdrawCents)} via Pix`}
          />
          <RuleRow
            testID="qi-rule-fee"
            text={`Taxa de ${formatBRL(rules.feeCents)} por saque, isenta a partir de ${formatBRL(
              rules.feeFreeThresholdCents,
            )}`}
          />
          <RuleRow testID="qi-rule-unlimited" text={RULE_UNLIMITED} />
        </View>

        {/* CTA navy (2628:7296): mesmo texto de convite da tela do QI. */}
        <Pressable
          testID="btn-share-code"
          accessibilityRole="button"
          accessibilityLabel={SHARE_CTA_LABEL}
          onPress={handleShare}
          style={styles.shareButton}
        >
          <Text style={styles.shareLabel}>{SHARE_CTA_LABEL}</Text>
        </Pressable>

        {/* Nota estática (ver a DIVERGÊNCIA 4): NÃO é um botão. */}
        <Text testID="qi-regulation-note" style={styles.regulationNote}>
          {REGULATION_LABEL}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // ── Estados de carga e de erro (com o "Voltar") ────────────
  stateBody: {
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
    marginBottom: 16,
  },
  retryButton: {
    height: 44,
    borderRadius: 24,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    backgroundColor: colors.brand,
  },
  retryButtonDisabled: {
    opacity: 0.5, // mesmo esmaecimento dos demais botões em voo
  },
  retryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.contentLight,
  },
  // ── Corpo ──────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 20, // Figma padding/ml
    paddingBottom: 40, // respiro sob a tab bar flutuante
    rowGap: 16, // Figma gap/m entre os blocos do corpo
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
  // ── Cabeçalho (2628:7236) ──────────────────────────────────
  header: {
    alignItems: 'center',
    rowGap: 8, // Figma gap/s
  },
  headerBadge: {
    width: 56,
    height: 56,
    borderRadius: 16, // Figma border/radius/m
    borderWidth: 2, // Figma border/size/m
    borderColor: colors.contentLight,
    backgroundColor: colors.accent, // Figma surface/error
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 32, // Figma font/size/2xl
    color: colors.contentLight,
  },
  headerTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24, // Figma font/size/l
    color: colors.brand,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16, // Figma font/size/m
    color: colors.textPrimary,
    textAlign: 'center',
  },
  // ── Passos numerados (2628:7241) ───────────────────────────
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16, // Figma gap/m
    backgroundColor: colors.surface,
    borderWidth: 1, // Figma border/size/s
    borderColor: colors.surfaceGrey, // Figma border/disable
    borderRadius: 16, // Figma border/radius/m
    padding: 16, // Figma padding/m
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 24, // Figma border/radius/l
    backgroundColor: colors.surfacePrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20, // Figma font/size/ml
    color: colors.brand,
  },
  stepInfo: {
    flex: 1,
    rowGap: 4, // Figma gap/xs
  },
  stepTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  stepDescription: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12, // Figma font/size/s
    color: colors.textSecondary,
  },
  // ── Títulos de seção (2628:7259 e 2628:7282) ───────────────
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent, // Figma surface/error
  },
  // ── Card "Quanto você ganha?" (2628:7260) ──────────────────
  earnCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    borderRadius: 16,
    padding: 16,
    rowGap: 12, // Figma gap/sm
  },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12, // Figma gap/sm
  },
  earnBadge: {
    width: 36,
    height: 36,
    borderRadius: 4, // Figma border/radius/s
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnBadgeSuccess: {
    backgroundColor: colors.surfaceSuccessLight,
  },
  earnBadgeWarning: {
    backgroundColor: colors.surfaceWarningLight,
  },
  earnBadgeInfo: {
    backgroundColor: colors.surfaceInfoLight,
  },
  earnGlyph: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
  },
  earnGlyphSuccess: {
    color: colors.surfaceSuccess, // Figma content/success
  },
  earnGlyphWarning: {
    color: colors.contentWarning, // Figma content/warning
  },
  earnGlyphInfo: {
    color: colors.brand, // Figma content/primary
  },
  earnInfo: {
    flex: 1,
    rowGap: 4,
  },
  earnLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  earnHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  earnValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.surfaceSuccess,
  },
  // ── Card "Regras de participação" (2628:7283) ──────────────
  rulesCard: {
    rowGap: 12, // Figma gap/sm
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 8, // Figma gap/s
  },
  ruleText: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textPrimary,
  },
  // ── CTA navy e nota do regulamento (2628:7296 e 2628:7297) ─
  shareButton: {
    height: 52,
    borderRadius: 24, // Figma border/radius/l
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  shareLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  regulationNote: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.brand,
    textAlign: 'center',
    paddingVertical: 12, // Figma padding/sm (mesma caixa de 44 px do Figma)
  },
});
