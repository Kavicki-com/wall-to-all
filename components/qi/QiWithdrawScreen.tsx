// F4 (QI): dados 100% dos mocks (QiService + WalletService); a unificação com o
// backend é F-futuro.
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQiService, useWalletService } from '../../context/ServicesContext';
import { WithdrawFlow } from '../wallet/WithdrawFlow';
import { Icon } from '../ui/Icon';
import { handleError } from '../../lib/errorHandler';
import { qiRoute } from '../../lib/qi/routes';
import type { PixKey, QiProgramRules, QiSide, QiSummary } from '../../lib/services/types';
import { colors } from '../../lib/theme';

export interface QiWithdrawScreenProps {
  /**
   * Lado do programa: seleciona as fixtures no QiService E o grupo de rotas
   * ('client' → `/(client)/qi/...`, 'merchant' → `/(merchant)/qi/...`) do
   * cadastro de chave Pix.
   */
  side: QiSide;
}

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/** Rótulo do hero, literal do Figma (2628:6376 e 🆕 2715:3714); ver a nota 4. */
const HERO_LABEL = 'Saldo disponível';

/** Corpo do estado de erro (a tela sempre oferece o "Voltar" e o retry). */
const LOAD_ERROR_MESSAGE = 'Não foi possível carregar os dados do saque.';

/* DIVERGÊNCIAS deliberadas do Figma (documentadas p/ o revisor). O layout 🆕
   `2715:3711` já foi implementado no `WithdrawFlow` (Task 4), que documenta as
   próprias divergências; abaixo ficam as do node do QI `2628:6373` (o node é o
   do lojista, saldo R$ 89,09; o do cliente é o espelho), conferido node a node
   contra o 🆕: onde os dois discordam, segue-se o 🆕, conforme a regra do plano:
   1. TOP BAR. O node do QI abre com a top bar navy do app (2628:6374), cujo
      único controle é o menu do AppDrawer, e ela NÃO é renderizada aqui. A top
      bar com o menu é das telas-hub; sub-telas empurradas na pilha, como esta,
      usam o "Voltar" fantasma como afordância de saída, com precedente em
      `components/wallet/PixKeyForm.tsx:162` e nas telas irmãs do QI. O "Voltar"
      aparece nos TRÊS estados (carga, erro e formulário), e como não há top bar
      o cabeçalho é o topo da tela e absorve o inset superior.
   2. AVISO DE MÍNIMO. O node traz um segundo aviso, "Valores mínimos
      necessários para realização de saque devem ser de R$50,00" (2628:6427),
      que CONTRADIZ as regras do programa: `minWithdrawCents` é R$ 30,00. O
      `WithdrawFlow` omite o texto estático (mesma decisão que o 🆕 motivou) e o
      mínimo REAL entra por prop, lido de `getProgramRules()`, nunca fixado na
      tela. Mesma escolha da tela "Como funciona o QI", que também formata o
      mínimo a partir das regras.
   3. SEGUNDO BOTÃO. O bloco de ações traz DUAS instâncias de botão (2628:6429 e
      2628:6430, a segunda "Cancelar saque"); só a confirmação é renderizada,
      porque cancelar é exatamente o que o "Voltar" já faz: dois controles para
      a mesma saída seriam ruído (mesma decisão do 🆕).
   4. RÓTULO DO HERO: NÃO é divergência do Figma, e sim do vocabulário do QI. O
      node do QI (2628:6376) e o 🆕 (2715:3714) escrevem "Saldo disponível", e é
      exatamente esse o rótulo usado aqui: a tela CONCORDA com o design. A
      divergência é interna, contra a tela-mãe do QI, que chama o MESMO saldo de
      "Saldo Cashback"; uniformizar os dois é decisão de produto, não de
      implementação. O valor exibido é o do QI (`getQiSummary(side)`), não o da
      carteira/Financeiro: os dois saldos são independentes.
   Os estados de carga e o modal do QI (loading 2628:7300 · 2628:6464, modal
   2628:7299 · 2628:6463) são espelhos exatos entre os lados e já vivem no
   `WithdrawFlow` (overlay "Por favor, aguarde....." e modal "Saque solicitado");
   os nodes de modal são instâncias da biblioteca com copy de placeholder
   ("Remover Produto?"), então a copy real vem da especificação, não do node. */

/**
 * Tela de solicitação de saque do QI (F4, Task 12), COMPARTILHADA pelos dois
 * lados do app: as rotas `app/(client)/qi/withdraw.tsx` e
 * `app/(merchant)/qi/withdraw.tsx` são finas e só injetam o lado. Figma 🆕
 * `2715:3711` e node do QI `2628:6373`.
 *
 * CASCA FINA: dona da carga de dados e da navegação; formulário, resumo, overlay
 * de carregamento e modal de sucesso vivem no `WithdrawFlow` compartilhado
 * (Task 4), o MESMO que o saque do Financeiro consome.
 *
 * DUAS fontes de dado, de propósito (decisão de arquitetura da fase): saldo,
 * cotação e confirmação vêm do `QiService` (`getQiSummary(side)`,
 * `quoteWithdraw`, `requestQiWithdraw(side, ...)`); as chaves Pix vêm do
 * `WalletService` (`getPixKeys()`), porque a mesma chave vale em todo o app e o
 * QI não é dono delas. O saldo do QI é INDEPENDENTE do saldo do Financeiro
 * (`getMerchantBalanceCents`), que é o que o saque de lá exibe. O valor mínimo
 * sai de `getProgramRules()`: dado de domínio, nunca literal de tela.
 *
 * Carrega resumo + regras + chaves EM PARALELO ao FOCAR (useFocusEffect): ao
 * voltar do cadastro de chave (`qi/new-pix-key` → `router.back()`) a tela
 * permanece montada, e só o refoco reflete a chave recém-criada. A carga mora
 * numa `load` memoizada, chamada tanto pelo efeito quanto pelo "Tentar
 * novamente"; como existe esse gatilho externo, a corrida é resolvida por um
 * token monotônico (`runIdRef`), não por um flag preso ao ciclo do efeito.
 * `loaded` segura o spinner só no primeiro load. Falha de carga mostra estado de
 * erro com retry, nunca spinner infinito, e tanto a carga quanto o erro
 * preservam o "Voltar".
 */
export const QiWithdrawScreen: React.FC<QiWithdrawScreenProps> = ({ side }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qiService = useQiService();
  const walletService = useWalletService();

  const [loaded, setLoaded] = useState(false);
  // Recarga disparada pelo "Tentar novamente": desabilita o botão e mostra
  // progresso (sem isso, o botão parece morto e convida a toques repetidos,
  // cada um disparando uma carga nova). Mesmo padrão das telas irmãs do QI.
  const [reloading, setReloading] = useState(false);
  const [summary, setSummary] = useState<QiSummary | null>(null);
  const [rules, setRules] = useState<QiProgramRules | null>(null);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);

  const runIdRef = useRef(0);

  const load = useCallback(async () => {
    const runId = ++runIdRef.current;
    try {
      const [summaryResult, rulesResult, pixResult] = await Promise.all([
        qiService.getQiSummary(side),
        qiService.getProgramRules(),
        walletService.getPixKeys(),
      ]);
      if (runIdRef.current !== runId) return;
      setSummary(summaryResult);
      setRules(rulesResult);
      setPixKeys(pixResult);
    } catch (error) {
      // Sem este catch a rejeição escaparia como unhandled rejection. No
      // primeiro load `summary` fica nulo e o gate abaixo mostra o estado de
      // erro (com "Tentar novamente") em vez de prender o usuário no spinner;
      // num refoco (o caso provável: voltar de `qi/new-pix-key`), os últimos
      // dados bons seguem na tela e a falha só é registrada.
      handleError(error, 'general');
    } finally {
      if (runIdRef.current === runId) {
        setLoaded(true);
        setReloading(false);
      }
    }
  }, [qiService, walletService, side]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        runIdRef.current++;
      };
    }, [load]),
  );

  // "Tentar novamente" do estado de erro: mesma carga do efeito, sem estado
  // gatilho. Guarda contra duplo-toque (o botão também fica `disabled`).
  const handleRetry = useCallback(() => {
    if (reloading) return;
    setReloading(true);
    void load();
  }, [load, reloading]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Sem top bar, o cabeçalho é o topo da tela e absorve o inset superior; ele é
  // renderizado nos TRÊS estados, então a saída nunca fica sob a status bar.
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        testID="btn-back"
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={HIT_SLOP}
        style={styles.backButton}
        onPress={handleBack}
      >
        <Icon name="chevron-left" size={24} color={colors.brand} />
        <Text style={styles.backText}>Voltar</Text>
      </Pressable>
    </View>
  );

  let body: React.ReactNode;
  if (!loaded) {
    body = (
      <View style={styles.stateCenter}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  } else if (!summary || !rules) {
    body = (
      <View style={styles.stateCenter}>
        <Text style={styles.errorText}>{LOAD_ERROR_MESSAGE}</Text>
        <Pressable
          testID="btn-retry"
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
          accessibilityState={{ disabled: reloading, busy: reloading }}
          disabled={reloading}
          style={[styles.retryButton, reloading && styles.retryButtonDisabled]}
          onPress={handleRetry}
        >
          {/* O rótulo não some durante a recarga (o botão não muda de largura e
              o leitor de tela continua anunciando a ação): o progresso vem do
              spinner ao lado, do esmaecimento e do `disabled`. */}
          {reloading && <ActivityIndicator size="small" color={colors.contentLight} />}
          <Text style={styles.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <WithdrawFlow
        heroLabel={HERO_LABEL}
        balanceCents={summary.balanceCents}
        pixKeys={pixKeys}
        quote={(cents) => qiService.quoteWithdraw(cents)}
        onConfirm={(cents, keyId) => qiService.requestQiWithdraw(side, cents, keyId)}
        minWithdrawCents={rules.minWithdrawCents}
        onAddPixKey={() => router.push(qiRoute(side, 'new-pix-key'))}
        onSuccessClose={handleBack}
      />
    );
  }

  return (
    <View style={styles.container}>
      {header}
      {body}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // ── Cabeçalho ("Voltar" fantasma) ─────────────────────────
  header: {
    paddingHorizontal: 20, // Figma padding/ml
    paddingBottom: 8,
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
  // ── Estados de carga e de erro ────────────────────────────
  stateCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20, // Figma padding/ml (igual ao cabeçalho)
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    height: 44,
    borderRadius: 24, // Figma border/radius/l
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
});
