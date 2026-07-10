import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { getInitials } from '../../lib/formatters';
import { colors } from '../../lib/theme';

export interface StoriesRowStore {
  id: number;
  name: string;
  logoUrl: string | null;
}

export interface StoriesRowProps {
  stores: StoriesRowStore[];
  /** Toque num story. Default no-op — o feed de stories chega na F6. */
  onPressStore?: (store: StoriesRowStore) => void;
}

// Dimensões do Figma (2715:3438): anel de 72px com foto interna de 62px.
const RING_SIZE = 72;
const PHOTO_SIZE = 62;

/**
 * Linha horizontal de "stories" dos negócios em destaque na home do cliente
 * (F2 — Dashboards/Home). Puramente apresentacional: recebe as lojas e um
 * callback de toque. Cada item é um anel circular (borda vermelha) com a foto
 * da loja — ou suas iniciais quando não há `logoUrl` — e o nome abaixo.
 *
 * Sem lojas, não renderiza nada (a seção some da home).
 */
export const StoriesRow: React.FC<StoriesRowProps> = ({
  stores,
  onPressStore,
}) => {
  if (stores.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {stores.map((store) => {
        const hasLogo = !!store.logoUrl && store.logoUrl.trim() !== '';

        return (
          <Pressable
            key={store.id}
            testID={`story-${store.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Stories de ${store.name}`}
            // TODO(F6): abrir feed/stories do negócio. Por ora, um no-op — o
            // feed de stories só chega na F6, então o toque é um placeholder.
            onPress={() => onPressStore?.(store)}
            style={styles.item}
          >
            <View style={styles.ring}>
              {hasLogo ? (
                <Image
                  source={{ uri: store.logoUrl as string }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ) : (
                // Fallback sem logo: círculo claro com iniciais na cor da marca.
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Text style={styles.initials}>{getInitials(store.name)}</Text>
                </View>
              )}
            </View>

            <Text style={styles.name} numberOfLines={1}>
              {store.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 12,
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    gap: 4,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    backgroundColor: colors.surfacePrimaryExtraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: colors.brand,
  },
  name: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
    width: RING_SIZE,
  },
});
