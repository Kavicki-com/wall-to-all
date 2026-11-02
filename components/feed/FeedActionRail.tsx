import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { formatCompactCount } from '../../lib/feed/format';

export interface FeedActionRailProps {
  liked: boolean;
  likeCount: number;
  onLike: () => void;
  /** Sem callback o botão "Agendar" não aparece (feed do lojista). */
  onSchedule?: () => void;
  onShare: () => void;
}

// Figma vide-card (2563:5735): botões brancos de 48, ícone 22, rótulo 12, gap 16 / 4.
const BUTTON_SIZE = 48;
const ICON_SIZE = 22;

interface RailButtonProps {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  children: React.ReactNode;
}

const RailButton: React.FC<RailButtonProps> = ({
  label,
  accessibilityLabel,
  onPress,
  children,
}) => (
  <View style={styles.item}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
    <Text style={styles.label} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

/** Coluna de ações sobre o card do feed: curtir, agendar (opcional) e compartilhar. */
export const FeedActionRail: React.FC<FeedActionRailProps> = ({
  liked,
  likeCount,
  onLike,
  onSchedule,
  onShare,
}) => (
  <View style={styles.rail}>
    <RailButton
      label={formatCompactCount(likeCount)}
      accessibilityLabel={liked ? 'Descurtir' : 'Curtir'}
      onPress={onLike}
    >
      <Icon
        name={liked ? 'favorite' : 'favorite-border'}
        size={ICON_SIZE}
        color={liked ? colors.accent : colors.brand}
      />
    </RailButton>
    {onSchedule ? (
      <RailButton label="Agendar" accessibilityLabel="Agendar" onPress={onSchedule}>
        <Icon
          name="calendar-clock-outline"
          family="MaterialCommunityIcons"
          size={ICON_SIZE}
          color={colors.brand}
        />
      </RailButton>
    ) : null}
    <RailButton label="Compart." accessibilityLabel="Compartilhar" onPress={onShare}>
      <Icon name="ios_share" family="MaterialSymbols" size={ICON_SIZE} color={colors.brand} />
    </RailButton>
  </View>
);

const styles = StyleSheet.create({
  rail: {
    alignItems: 'center',
    gap: 16,
  },
  item: {
    alignItems: 'center',
    gap: 4,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
  },
});
