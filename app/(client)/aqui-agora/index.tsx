import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, StatusBar } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import type { NearbyMerchant } from '../../../lib/services/types';
import SearchBar from '../../../components/SearchBar';
import { Chip } from '../../../components/ui/Chip';
import { ResultsSheet } from '../../../components/aqui-agora/ResultsSheet';
import { colors } from '../../../lib/theme';
import { formatBRL } from '../../../lib/formatters';
import { SP_CENTER } from '../../../lib/aqui-agora/constants';
import { useNearbyMerchants } from '../../../lib/hooks/useNearbyMerchants';

const INITIAL_REGION = {
  ...SP_CENTER,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

/** Espaço para a status bar (evita depender de safe-area-context nesta tela). */
const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 52;

/** Chips de categoria do topo (filtro rápido por texto). */
const CATEGORY_CHIPS = [
  'Barbeiro',
  'Manicure',
  'Encanador',
  'Marceneiro',
  'Pedreiro',
  'Massagista',
];

/**
 * Tela "Aqui e Agora" (cliente): mapa em tela cheia com marcadores dos
 * merchants próximos, barra de busca sobreposta no topo e um bottom-sheet de
 * resultados. Os dados vêm do `QueueService` (via `useQueueService`), nunca de
 * uma instância criada aqui. A busca filtra a lista por nome/categoria
 * (substring, case-insensitive) e reflete nos marcadores do mapa.
 */
const MapSearchScreen: React.FC = () => {
  const router = useRouter();
  const { merchants, status } = useNearbyMerchants();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter(
      (merchant) =>
        merchant.name.toLowerCase().includes(q) || merchant.category.toLowerCase().includes(q),
    );
  }, [merchants, query]);

  const handlePressMerchant = useCallback(
    (merchant: NearbyMerchant) => {
      router.push(`/(client)/aqui-agora/merchant/${merchant.id}`);
    },
    [router],
  );

  const handleChipPress = useCallback((label: string) => {
    setQuery((current) => (current.toLowerCase() === label.toLowerCase() ? '' : label));
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
      >
        {filtered.map((merchant) => (
          <Marker key={merchant.id} coordinate={merchant.coordinate}>
            {merchant.queue.settings.furaFilaEnabled && (
              <View style={styles.pin}>
                <Text style={styles.pinText}>
                  {formatBRL(merchant.queue.settings.furaFilaPriceCents)}
                </Text>
              </View>
            )}
          </Marker>
        ))}
      </MapView>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: TOP_INSET }]}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Procurar serviços"
            onClear={() => setQuery('')}
            showFilterButton
            onPressFilter={() => {}}
            containerStyle={styles.searchBar}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsRow}
            contentContainerStyle={styles.chipsContent}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORY_CHIPS.map((label) => (
              <Chip
                key={label}
                label={label}
                variant={query.toLowerCase() === label.toLowerCase() ? 'filled' : 'outline'}
                onPress={() => handleChipPress(label)}
                style={styles.chip}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.spacer} pointerEvents="none" />

        <ResultsSheet merchants={filtered} onPressMerchant={handlePressMerchant} status={status} />
      </View>
    </View>
  );
};

export default MapSearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceGrey,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  topBar: {
    paddingBottom: 8,
  },
  searchBar: {
    paddingHorizontal: 16,
  },
  chipsRow: {
    marginTop: 12,
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: 16,
    columnGap: 8,
  },
  chip: {
    marginRight: 8,
  },
  spacer: {
    flex: 1,
  },
  pin: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pinText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: colors.white,
  },
});
