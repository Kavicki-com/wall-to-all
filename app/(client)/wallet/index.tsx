import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useWalletService } from '../../../context/ServicesContext';
import type { PaymentCard, PixKey, WalletEntry } from '../../../lib/services/types';
import { HomeTopBar } from '../../../components/home/HomeTopBar';
import { AppDrawer, DrawerItem } from '../../../components/layout/AppDrawer';
import { CardsStack } from '../../../components/payment/CardsStack';
import { PixKeySection } from '../../../components/wallet/PixKeySection';
import { StatementTimeline } from '../../../components/wallet/StatementTimeline';
import { colors } from '../../../lib/theme';

// Itens do menu (drawer) do cliente — espelham a lista da home + "Carteira".
// Constante de módulo (estáticos): não realoca a cada render.
const DRAWER_ITEMS: DrawerItem[] = [
  { label: 'Início', route: '/(client)/home' },
  { label: 'Meus agendamentos', route: '/(client)/appointments' },
  { label: 'Buscar serviços', route: '/(client)/search' },
  { label: 'Carteira', route: '/(client)/wallet' },
  { label: 'Perfil', route: '/(client)/profile' },
  { label: 'Configurações', route: '/(client)/settings' },
];

/**
 * Carteira do cliente (Figma node 2715:3681).
 *
 * Top bar navy com apenas o menu (sem sino — omitimos `onBell`, então a
 * HomeTopBar oculta o sino) que abre o AppDrawer. Três seções empilhadas:
 * "Meus cartões" (pilha de cartões + botão outline "Adicionar cartão"),
 * "Chaves Pix" (PixKeySection: lista + botão "Adicionar chave Pix") e "Extrato"
 * (StatementTimeline, vazio no mock do cliente).
 *
 * Carrega cartões, chaves e extrato em paralelo via WalletService. Usa
 * `useFocusEffect` para recarregar ao focar a tela, de modo que um cartão/chave
 * recém-cadastrado (Tasks 5/6) apareça quando o usuário volta das telas de
 * cadastro. Um `active`-guard evita setState após desmontar.
 */
const ClientWalletScreen: React.FC = () => {
  const router = useRouter();
  const walletService = useWalletService();

  // O AppDrawer é dono do estado aqui (a HomeTopBar só dispara `onMenu`).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [statement, setStatement] = useState<WalletEntry[]>([]);

  // Recarrega os três recursos ao focar (mount inclusive). Depois do primeiro
  // load, `loaded` permanece true — refocos apenas atualizam os dados, sem
  // repor o spinner (evita flash ao voltar de uma tela de cadastro).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [cardsResult, pixResult, statementResult] = await Promise.all([
            walletService.getCards(),
            walletService.getPixKeys(),
            walletService.getStatement(),
          ]);
          if (!active) return;
          setCards(cardsResult);
          setPixKeys(pixResult);
          setStatement(statementResult);
        } finally {
          if (active) {
            setLoaded(true);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [walletService]),
  );

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.root}>
        <HomeTopBar onMenu={openDrawer} />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Meus cartões — pilha de cartões + botão outline "Adicionar cartão". */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meus cartões</Text>
            <CardsStack cards={cards} style={styles.cardsStack} />
            <Pressable
              testID="btn-add-card"
              accessibilityRole="button"
              accessibilityLabel="Adicionar cartão"
              onPress={() => router.push('/(client)/wallet/new-card')}
              style={styles.addCardButton}
            >
              <Text style={styles.addCardLabel}>+  Adicionar cartão</Text>
            </Pressable>
          </View>

          {/* Chaves Pix — lista de chaves + botão "Adicionar chave Pix". */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chaves Pix</Text>
            <PixKeySection
              keys={pixKeys}
              onAddPress={() => router.push('/(client)/wallet/new-pix-key')}
            />
          </View>

          {/* Extrato — timeline de lançamentos (vazio no mock do cliente). */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extrato</Text>
            <StatementTimeline
              entries={statement}
              emptyMessage="Nenhum lançamento encontrado"
            />
          </View>
        </ScrollView>
      </View>

      {/* Menu lateral — irmão da View raiz para não viver dentro do ScrollView. */}
      <AppDrawer visible={drawerOpen} onClose={closeDrawer} items={DRAWER_ITEMS} />
    </>
  );
};

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
  content: {
    paddingHorizontal: 24, // Figma padding/l
    paddingTop: 24,
    paddingBottom: 40, // respiro sob a tab bar flutuante
  },
  section: {
    marginBottom: 24, // Figma gap/l entre seções
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
    marginBottom: 16, // Figma gap/m dentro da seção
  },
  cardsStack: {
    marginBottom: 16,
  },
  addCardButton: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
});

export default ClientWalletScreen;
