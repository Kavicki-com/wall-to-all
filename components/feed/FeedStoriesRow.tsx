import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getInitials } from '../../lib/formatters';
import { colors } from '../../lib/theme';
import type { FeedAuthor, FeedStoryGroup } from '../../lib/services/feedTypes';

export interface FeedStoriesRowOwnStory {
  author: FeedAuthor;
  /** O próprio negócio tem post nas últimas 24h: anel vermelho. */
  active: boolean;
}

export interface FeedStoriesRowProps {
  groups: FeedStoryGroup[];
  /** Só no feed do lojista: slot "Seu story" no início da fila. */
  ownStory?: FeedStoriesRowOwnStory | null;
  onPressGroup: (group: FeedStoryGroup) => void;
  onPressOwn?: () => void;
}

// Figma stories (2563:5228 lojista, 2643:7842 cliente): mesmo desenho da
// StoriesRow da F2. Anel 72, foto 62, borda 2, nome 12, badge "+" de 22.
const RING_SIZE = 72;
const PHOTO_SIZE = 62;
const BADGE_SIZE = 22;

const Avatar: React.FC<{ author: FeedAuthor }> = ({ author }) => {
  const hasLogo = !!author.logoUrl && author.logoUrl.trim() !== '';
  if (hasLogo) {
    return (
      <Image source={{ uri: author.logoUrl as string }} style={styles.photo} resizeMode="cover" />
    );
  }
  return (
    <View style={[styles.photo, styles.photoPlaceholder]}>
      <Text style={styles.initials}>{getInitials(author.name)}</Text>
    </View>
  );
};

/**
 * Fila de stories do feed (F6), sobre o fundo navy. Cada anel é uma loja com
 * post nas últimas 24h. No lojista, "Seu story" abre a câmera; o anel fica
 * vermelho quando o próprio negócio já publicou nas últimas 24h.
 */
export const FeedStoriesRow: React.FC<FeedStoriesRowProps> = ({
  groups,
  ownStory,
  onPressGroup,
  onPressOwn,
}) => {
  if (groups.length === 0 && !ownStory) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {ownStory ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Seu story"
          onPress={() => onPressOwn?.()}
          style={styles.item}
        >
          <View
            testID={ownStory.active ? 'own-story-ring-active' : 'own-story-ring'}
            style={[styles.ring, ownStory.active ? styles.ringActive : styles.ringOwn]}
          >
            <Avatar author={ownStory.author} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>+</Text>
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            Seu story
          </Text>
        </Pressable>
      ) : null}

      {groups.map((group) => (
        <Pressable
          key={group.author.businessId}
          testID={`feed-story-${group.author.businessId}`}
          accessibilityRole="button"
          accessibilityLabel={`Stories de ${group.author.name}`}
          onPress={() => onPressGroup(group)}
          style={styles.item}
        >
          <View style={[styles.ring, styles.ringActive]}>
            <Avatar author={group.author} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {group.author.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingHorizontal: 20,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringActive: {
    borderColor: colors.accent,
  },
  ringOwn: {
    borderColor: colors.contentLight,
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
  badge: {
    position: 'absolute',
    bottom: 1,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    lineHeight: 20,
    color: colors.contentLight,
  },
  name: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
    textAlign: 'center',
    maxWidth: RING_SIZE + 20,
  },
});
