// F4 (QI): dados 100% do QiService mock; a unificação com o backend é F-futuro.
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQiService } from '../../../context/ServicesContext';
import type { QiIndicacao, QiSummary } from '../../../lib/services/types';
import { HomeTopBar } from '../../../components/home/HomeTopBar';
import { AppDrawer, DrawerItem } from '../../../components/layout/AppDrawer';
import { QiEarningsCard } from '../../../components/qi/QiEarningsCard';
import { QiCodeCard } from '../../../components/qi/QiCodeCard';
import { QiIndicadosList } from '../../../components/qi/QiIndicadosList';
import { Icon } from '../../../components/ui/Icon';
import { buildQiShareMessage } from '../../../lib/qi/shareMessage';
import { handleError } from '../../../lib/errorHandler';
import { formatBRL } from '../../../lib/formatters';
import { colors } from '../../../lib/theme';

// Este lado é sempre o do cliente (a tela do lojista é uma rota irmã).
const SIDE = 'client' as const;

// Itens do menu (drawer) do cliente — os MESMOS da home, acrescidos de "QI"
// (esta tela). Constante de módulo: não realoca a cada render.
const DRAWER_ITEMS: DrawerItem[] = [
  { label: 'Início', route: '/(client)/home' },
  { label: 'Meus agendamentos', route: '/(client)/appointments' },
  { label: 'Buscar serviços', route: '/(client)/search' },
  { label: 'Carteira', route: '/(client)/wallet' },
  { label: 'QI', route: '/(client)/qi' },
  { label: 'Perfil', route: '/(client)/profile' },
  { label: 'Configurações', route: '/(client)/settings' },
];

// Subtítulo do card de código — muda entre o estado completo e o vazio (Figma
// nodes 2628:6975 completo / 2628:7084 vazio).
const SHARE_SUBTITLE_COMPLETE = 'Convide amigos e ganhe 50% sobre as mensalidades';
const SHARE_SUBTITLE_EMPTY = 'Convide amigos e receba cashback no PIX';

// Mensagem da lista "Amigos indicados" sem indicações (Figma node 2628:7090).
const INDICADOS_EMPTY_MESSAGE =
  'Você ainda não fez nenhuma indicação, compartilhe seu código QI para ganhar mais.';

/**
 * Tela do programa QI do CLIENTE (F4 — Task 8, Figma nodes 2628:6934 completo e
 * 2628:7044 vazio). Rota única: os estados completo e vazio são inteiramente
 * dirigidos pelos dados (um resumo zerado + lista vazia = estado "em branco").
 *
 * Mesma casca das telas do novo escopo: HomeTopBar navy (menu → AppDrawer com os
 * itens do cliente + "QI"). Abaixo, um hero navy com o Saldo Cashback e o botão
 * "Solicitar Saque", um "Voltar" fantasma, o card "Ganhos por indicação"
 * (QiEarningsCard), a seção "Compartilhe seu código" (QiCodeCard) e a seção
 * "Amigos indicados" (QiIndicadosList paginada), encerrando num link fantasma
 * "Como funciona o QI".
 *
 * Carrega resumo, código e a 1ª página de indicados EM PARALELO ao focar
 * (useFocusEffect), recarregando quando o usuário volta de uma sub-tela (saque,
 * detalhe). Um `active`-guard evita setState após desmontar; `loaded` segura o
 * spinner só no primeiro load. A paginação mantém a página local e refaz a carga
 * a cada troca (ver a nota do efeito). Falha de carga no primeiro load mostra um
 * estado de erro com "Tentar novamente", nunca um spinner infinito.
 */
const ClientQiScreen: React.FC = () => {
  const router = useRouter();
  const qiService = useQiService();

  // O AppDrawer é dono do estado aqui (a HomeTopBar só dispara `onMenu`).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [summary, setSummary] = useState<QiSummary | null>(null);
  const [code, setCode] = useState('');
  const [items, setItems] = useState<QiIndicacao[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Bump manual do "Tentar novamente" do estado de erro: re-dispara o efeito.
  const [reloadKey, setReloadKey] = useState(0);

  // Recarrega resumo + código + a página ATUAL ao focar (mount inclusive) e
  // sempre que `page` muda (a paginação só atualiza o estado local — este efeito
  // é quem refaz `listIndicacoes`). Depois do primeiro load, `loaded` permanece
  // true — refocos só atualizam os dados, sem repor o spinner (evita flash ao
  // voltar de uma sub-tela). Um `active`-guard evita setState após desmontar.
  //
  // Escolha deliberada: UM efeito só. Como `page` está nas deps, trocar de
  // página refaz também `getQiSummary` e `getQiCode`, além do `listIndicacoes`
  // que a especificação pede. Separar em dois efeitos complicaria o gate de
  // `loaded` e arriscaria um flash do estado vazio entre as páginas, para
  // economizar chamadas que hoje são de mock com latência 0.
  // TODO(F8): com o backend real, a troca de página deve refazer APENAS a lista
  // (senão custa 2 requisições de rede extras por clique de paginação).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [summaryResult, codeResult, pageResult] = await Promise.all([
            qiService.getQiSummary(SIDE),
            qiService.getQiCode(SIDE),
            qiService.listIndicacoes(SIDE, page),
          ]);
          if (!active) return;
          setSummary(summaryResult);
          setCode(codeResult);
          setItems(pageResult.items);
          setTotalPages(pageResult.totalPages);
        } catch (error) {
          // Sem este catch a rejeição escaparia como unhandled rejection. No
          // primeiro load `summary` fica nulo e o gate abaixo mostra o estado de
          // erro (com "Tentar novamente") em vez de prender o usuário no
          // spinner; num refoco/troca de página, os últimos dados bons seguem na
          // tela e a falha só é registrada.
          handleError(error, 'general');
        } finally {
          if (active) setLoaded(true);
        }
      })();
      return () => {
        active = false;
      };
      // `reloadKey` não é lido no corpo: entra nas deps só para o "Tentar
      // novamente" re-disparar a carga (invalidação intencional).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qiService, page, reloadKey]),
  );

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Troca de página: só atualiza o estado local; o useFocusEffect (que depende de
  // `page`) refaz a carga e atualiza itens/total (ver a nota do efeito).
  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  // `await` + try/catch: sem eles, uma rejeição do share (cancelamento/erro no
  // Android) viraria unhandled rejection. Mesmo tratamento do share do lojista.
  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: buildQiShareMessage(code) });
    } catch (error) {
      handleError(error, 'general');
    }
  }, [code]);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  // Falha no primeiro load (resumo ausente): estado de erro com "Tentar
  // novamente" (o bump de `reloadKey` re-dispara o efeito), como na tela de
  // configurações do Aqui e Agora. Nunca deixa o usuário preso no spinner.
  if (!summary) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Não foi possível carregar o seu QI.</Text>
        <Pressable
          testID="btn-retry"
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
          onPress={() => setReloadKey((key) => key + 1)}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  // Estado "em branco": sem indicados (dirige subtítulo do código). O saldo e os
  // indicadores já vêm zerados do resumo vazio.
  const isEmpty = summary.indicadosCount === 0;
  const codeSubtitle = isEmpty ? SHARE_SUBTITLE_EMPTY : SHARE_SUBTITLE_COMPLETE;

  // Saldo formatado (centavos → "R$ 74,09"): parte inteira em 32 e centavos em
  // 24 (Figma), num único Text para "74,09" permanecer contíguo.
  const formattedBalance = formatBRL(summary.balanceCents);
  const commaIndex = formattedBalance.lastIndexOf(',');
  const balanceInt =
    commaIndex === -1 ? formattedBalance : formattedBalance.slice(0, commaIndex);
  const balanceCentsPart = commaIndex === -1 ? '' : formattedBalance.slice(commaIndex);

  return (
    <>
      <View style={styles.root}>
        <HomeTopBar onMenu={openDrawer} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero navy: Saldo Cashback + botão "Solicitar Saque". */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Saldo Cashback</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroBalanceInt} testID="qi-balance">
                {balanceInt}
                <Text style={styles.heroBalanceCents}>{balanceCentsPart}</Text>
              </Text>
              <Pressable
                testID="btn-withdraw"
                accessibilityRole="button"
                accessibilityLabel="Solicitar saque"
                onPress={() => router.push('/(client)/qi/withdraw')}
                style={styles.withdrawButton}
              >
                <Text style={styles.withdrawLabel}>Solicitar Saque</Text>
              </Pressable>
            </View>
          </View>

          {/* Corpo com padding próprio (o hero sangra até as bordas). */}
          <View style={styles.body}>
            {/* "Voltar" fantasma — mesma convenção das demais sub-telas. */}
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

            {/* Ganhos por indicação (saldo, lucro, indicados, bônus, meta). */}
            <QiEarningsCard summary={summary} testID="qi-earnings-card" />

            {/* Compartilhe seu código — subtítulo varia por estado. */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Compartilhe seu código</Text>
              <QiCodeCard
                code={code}
                subtitle={codeSubtitle}
                onShare={handleShare}
                testID="qi-code-card"
              />
            </View>

            {/* Amigos indicados — lista paginada; vazio → mensagem do Figma. */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amigos indicados</Text>
              <QiIndicadosList
                items={items}
                page={page}
                totalPages={totalPages}
                emptyMessage={INDICADOS_EMPTY_MESSAGE}
                onPressItem={(id) => router.push(`/(client)/qi/indicacao/${id}`)}
                onPageChange={handlePageChange}
                testID="qi-indicados-list"
              />
            </View>

            {/* DIVERGÊNCIA deliberada do Figma (documentada p/ o revisor):
                NENHUM dos dois estados prevê entrada para o "Como funciona o
                QI". No node 2628:6934 (completo) o body termina na `pagination`
                (2628:7043) e no 2628:7044 (vazio) termina na `friends-list`
                (2628:7091). O link fantasma abaixo foi acrescentado por decisão
                de produto (#8 do plano) para a tela de explicação (Task 11)
                ficar alcançável. */}
            <Pressable
              testID="btn-how-it-works"
              accessibilityRole="button"
              accessibilityLabel="Como funciona o QI"
              onPress={() => router.push('/(client)/qi/how-it-works')}
              style={styles.ghostButton}
            >
              <Text style={styles.ghostButtonText}>Como funciona o QI</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      {/* Menu lateral — irmão da View raiz para não viver dentro do ScrollView. */}
      <AppDrawer visible={drawerOpen} onClose={closeDrawer} items={DRAWER_ITEMS} />
    </>
  );
};

export default ClientQiScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  // ── Estado de erro de carga (mesmos tokens do Aqui e Agora) ────
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  retryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.contentLight,
  },
  scrollContent: {
    paddingBottom: 40, // respiro sob a tab bar flutuante
  },
  // ── Hero navy (Saldo Cashback) ─────────────────────────────
  hero: {
    backgroundColor: colors.brand,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    gap: 4,
  },
  heroLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroBalanceInt: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 32,
    color: colors.contentPrimaryLight,
    flexShrink: 1,
  },
  heroBalanceCents: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: colors.contentPrimaryLight,
  },
  withdrawButton: {
    borderWidth: 1,
    borderColor: colors.contentLight,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  withdrawLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
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
  section: {
    gap: 16, // Figma gap/m dentro da seção
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  // ── Link fantasma "Como funciona o QI" ─────────────────────
  ghostButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  ghostButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
});
