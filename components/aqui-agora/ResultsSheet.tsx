import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { NearbyMerchant } from '../../lib/services/types';
import { colors } from '../../lib/theme';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** Mapeia a categoria do merchant para um ícone do MaterialIcons. */
const CATEGORY_ICONS: Record<string, MaterialIconName> = {
  barbearia: 'content-cut',
  'salão de beleza': 'brush',
  cafeteria: 'local-cafe',
  restaurante: 'restaurant',
  'pet shop': 'pets',
  clínica: 'local-hospital',
};

/** Ícone para uma categoria (fallback: vitrine genérica). */
export function categoryIcon(category: string): MaterialIconName {
  return CATEGORY_ICONS[category.trim().toLowerCase()] ?? 'storefront';
}

/**
 * Distância legível: "800 m" para < 1 km, "0,3 km"/"2,4 km" para >= 1 km.
 * `distanceKm` já vem arredondado a 1 casa pelo QueueService.
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

interface MerchantRowProps {
  merchant: NearbyMerchant;
  onPress: (merchant: NearbyMerchant) => void;
}

/**
 * Linha da lista: a categoria é comunicada pelo ÍCONE (com accessibilityLabel),
 * não por texto visível — assim o único nó de texto que casa com o nome do
 * merchant é o próprio nome (evita ambiguidade quando nome e categoria
 * compartilham a mesma palavra, ex.: "Barbearia do Zé" / "Barbearia").
 */
const MerchantRow: React.FC<MerchantRowProps> = ({ merchant, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${merchant.name}, ${merchant.category}`}
    onPress={() => onPress(merchant)}
    style={styles.row}
  >
    <View style={styles.rowIcon}>
      <MaterialIcons
        name={categoryIcon(merchant.category)}
        size={22}
        color={colors.brand}
        accessibilityLabel={merchant.category}
      />
    </View>
    <View style={styles.rowBody}>
      <Text style={styles.rowName} numberOfLines={1}>
        {merchant.name}
      </Text>
      <View style={styles.rowMeta}>
        <MaterialIcons name="star" size={14} color={colors.warning} />
        <Text style={styles.rowMetaText}>{merchant.rating.toFixed(1)}</Text>
        <Text style={styles.rowMetaText}>·</Text>
        <Text style={styles.rowMetaText}>{formatDistance(merchant.distanceKm)}</Text>
      </View>
    </View>
    <MaterialIcons name="chevron-right" size={24} color={colors.neutral400} />
  </Pressable>
);

export interface ResultsSheetProps {
  merchants: NearbyMerchant[];
  onPressMerchant: (merchant: NearbyMerchant) => void;
}

/**
 * Bottom-sheet de resultados: alça de arraste, header "Disponíveis agora" com
 * um badge de quantos merchants estão com a fila ativa, e a lista rolável de
 * merchants próximos. A linha inteira é pressionável.
 */
export const ResultsSheet: React.FC<ResultsSheetProps> = ({ merchants, onPressMerchant }) => {
  const activeCount = useMemo(
    () => merchants.filter((merchant) => merchant.queue.status === 'active').length,
    [merchants],
  );

  return (
    <View style={styles.sheet} testID="results-sheet">
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.title}>Disponíveis agora</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{activeCount} ativos</Text>
        </View>
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {merchants.map((merchant) => (
          <MerchantRow key={merchant.id} merchant={merchant} onPress={onPressMerchant} />
        ))}
      </ScrollView>
    </View>
  );
};

export default ResultsSheet;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    maxHeight: '55%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceGrey,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  badge: {
    backgroundColor: colors.surfaceSuccessLight,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: colors.surfaceSuccess,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    columnGap: 12,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    columnGap: 4,
  },
  rowMetaText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: colors.neutral400,
  },
});
