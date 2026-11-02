import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { formatPostMeta } from '../../lib/feed/format';
import { getInitials } from '../../lib/formatters';
import type { FeedPost } from '../../lib/services/feedTypes';
import { FeedActionRail } from './FeedActionRail';

export interface FeedPostCardProps {
  post: FeedPost;
  /** Card visível no feed: só ele toca vídeo. */
  isActive: boolean;
  following: boolean;
  /** Falso nos posts do próprio lojista. */
  showFollow: boolean;
  onToggleFollow: () => void;
  onLike: () => void;
  /** Ausente no feed do lojista (sem "Agendar"). */
  onSchedule?: () => void;
  onShare: () => void;
}

// Figma vide-card (2563:5735): 342x524, raio 16, avatar 40 a 14px do canto,
// trilho a 12 da direita e 40 do fundo, rodapé a 12 da esquerda e do fundo.
const CARD_ASPECT_RATIO = 342 / 524;
const AVATAR_SIZE = 40;
// Sombra do rodapé: colors.shadow (#1D1D1D) com alfa, para o texto branco ler
// sobre qualquer mídia (o Figma usa um radial escuro com opacidade 0,5).
const BOTTOM_SHADE = ['rgba(29,29,29,0)', 'rgba(29,29,29,0.7)'];

/**
 * Player criado só para vídeo (componente separado para não instanciar player
 * em foto). Mudo e em loop; toca apenas quando o card está ativo.
 */
const CardVideo: React.FC<{ uri: string; isActive: boolean }> = ({ uri, isActive }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
};

/** Card de post do feed (F6): mídia em tela, autor, trilho de ações e "Seguir". */
export const FeedPostCard: React.FC<FeedPostCardProps> = ({
  post,
  isActive,
  following,
  showFollow,
  onToggleFollow,
  onLike,
  onSchedule,
  onShare,
}) => {
  const hasLogo = !!post.author.logoUrl && post.author.logoUrl.trim() !== '';

  return (
    <View style={styles.card}>
      {post.mediaType === 'video' ? (
        <CardVideo uri={post.mediaUri} isActive={isActive} />
      ) : (
        <Image
          testID="feed-post-photo"
          source={{ uri: post.mediaUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}

      <LinearGradient colors={BOTTOM_SHADE} locations={[0.45, 1]} style={styles.shade} />

      <View style={styles.avatar}>
        {hasLogo ? (
          <Image
            source={{ uri: post.author.logoUrl as string }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitials}>{getInitials(post.author.name)}</Text>
          </View>
        )}
      </View>

      <View style={styles.rail}>
        <FeedActionRail
          liked={post.likedByMe}
          likeCount={post.likeCount}
          onLike={onLike}
          onSchedule={onSchedule}
          onShare={onShare}
        />
      </View>

      <View style={styles.bottomInfo}>
        <Text style={styles.handle} numberOfLines={1}>
          {post.author.handle}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatPostMeta(post)}
        </Text>
        {showFollow ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: following }}
            onPress={onToggleFollow}
            style={({ pressed }) => [
              styles.followButton,
              following && styles.followingButton,
              pressed && styles.pressed,
            ]}
          >
            {following ? (
              <Icon name="check" size={20} color={colors.contentLight} />
            ) : (
              <Icon name="add" size={24} color={colors.contentLight} />
            )}
            <Text style={styles.followText}>{following ? 'Seguindo' : 'Seguir'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: CARD_ASPECT_RATIO,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.shadow,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  avatar: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.contentLight,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfacePrimaryExtraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.brand,
  },
  rail: {
    position: 'absolute',
    right: 12,
    bottom: 40,
  },
  bottomInfo: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    maxWidth: '65%',
    gap: 4,
    alignItems: 'flex-start',
  },
  handle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  meta: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
  },
  followButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 36,
    borderRadius: 24,
    backgroundColor: colors.accent,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    elevation: 2,
  },
  followingButton: {
    backgroundColor: colors.brand,
  },
  pressed: {
    opacity: 0.85,
  },
  followText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.contentLight,
  },
});
