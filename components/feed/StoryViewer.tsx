import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { getInitials } from '../../lib/formatters';
import type { FeedPost, FeedStoryGroup } from '../../lib/services/feedTypes';

export interface StoryViewerProps {
  visible: boolean;
  group: FeedStoryGroup | null;
  onClose: () => void;
}

/** Tempo de exibição de cada foto antes de avançar. */
export const PHOTO_STORY_MS = 5000;

const AVATAR_SIZE = 32;
// colors.shadow (#1D1D1D) com alfa, como o rodapé do FeedPostCard.
const CAPTION_SHADE = ['rgba(29,29,29,0)', 'rgba(29,29,29,0.7)'];

/** Vídeo do story: com som, sem loop; avisa o fim para avançar. */
const StoryVideo: React.FC<{ uri: string; onEnd: () => void }> = ({ uri, onEnd }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => onEndRef.current());
    player.play();
    return () => subscription.remove();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
};

function relativeTime(createdAt: string): string {
  return formatDistanceToNowStrict(new Date(createdAt), { locale: ptBR, addSuffix: true });
}

/**
 * Visualizador de stories em tela cheia (F6). Sem frame no Figma (divergência
 * #5): só tokens do tema. Barras de progresso por post, avanço automático
 * (foto em 5s, vídeo ao terminar), toque à esquerda volta e à direita avança,
 * e fecha ao passar do último post.
 */
export const StoryViewer: React.FC<StoryViewerProps> = ({ visible, group, onClose }) => {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  // Recomeça do primeiro post a cada abertura ou troca de grupo.
  useEffect(() => {
    setIndex(0);
  }, [group, visible]);

  const posts = group?.posts ?? [];
  const current: FeedPost | undefined = posts[index];

  const goNext = useCallback(() => {
    if (index < posts.length - 1) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  }, [index, posts.length, onClose]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Foto: avança por tempo. O timer é recriado a cada troca de índice e limpo
  // no unmount. Vídeo avança pelo evento playToEnd (StoryVideo).
  useEffect(() => {
    if (!visible || !current || current.mediaType !== 'photo') return undefined;
    const timer = setTimeout(goNext, PHOTO_STORY_MS);
    return () => clearTimeout(timer);
  }, [visible, current, goNext]);

  if (!visible || !group || !current) return null;

  const hasLogo = !!group.author.logoUrl && group.author.logoUrl.trim() !== '';

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        {current.mediaType === 'video' ? (
          <StoryVideo key={current.id} uri={current.mediaUri} onEnd={goNext} />
        ) : (
          <Image
            testID="story-photo"
            source={{ uri: current.mediaUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}

        <View style={styles.tapZones}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Story anterior"
            onPress={goPrev}
            style={styles.tapZone}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Próximo story"
            onPress={goNext}
            style={styles.tapZone}
          />
        </View>

        {current.caption ? (
          <View testID="story-caption" style={styles.captionArea} pointerEvents="none">
            <LinearGradient colors={CAPTION_SHADE} style={styles.captionShade} />
            <Text style={[styles.caption, { paddingBottom: insets.bottom + 32 }]}>
              {current.caption}
            </Text>
          </View>
        ) : null}

        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <View style={styles.progressRow}>
            {posts.map((p, i) => (
              <View key={p.id} style={styles.progressTrack}>
                {i <= index ? <View style={styles.progressFill} /> : null}
              </View>
            ))}
          </View>
          <View style={styles.header}>
            {hasLogo ? (
              <Image source={{ uri: group.author.logoUrl as string }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitials}>{getInitials(group.author.name)}</Text>
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={styles.handle} numberOfLines={1}>
                {group.author.handle}
              </Text>
              <Text style={styles.time}>{relativeTime(current.createdAt)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              onPress={onClose}
              hitSlop={12}
            >
              <Icon name="close" size={28} color={colors.contentLight} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.shadow,
  },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  tapZone: {
    flex: 1,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    gap: 12,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surfaceGrey,
    overflow: 'hidden',
  },
  progressFill: {
    flex: 1,
    backgroundColor: colors.contentLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfacePrimaryExtraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.brand,
  },
  headerText: {
    flex: 1,
  },
  handle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.contentLight,
  },
  time: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
  },
  captionArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  captionShade: {
    ...StyleSheet.absoluteFillObject,
  },
  caption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.contentLight,
    paddingHorizontal: 16,
    paddingTop: 48,
  },
});
