import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { useFeedService } from '../../context/ServicesContext';
import { useBusinessProfile } from '../../context/BusinessProfileContext';
import { toFeedAuthor } from '../../lib/feed/author';
import type { FeedPost, FeedStoryGroup } from '../../lib/services/feedTypes';
import { FeedPostCard } from './FeedPostCard';
import { FeedStoriesRow } from './FeedStoriesRow';
import { StoryViewer } from './StoryViewer';

export interface FeedScreenProps {
  role: 'client' | 'merchant';
  /** Cliente vindo da StoriesRow da home: abre os stories dessa loja, se houver. */
  initialBusinessId?: number;
}

type Status = 'loading' | 'error' | 'ready';

// Figma feed (2485:146 lojista, 2643:7839 cliente): top bar 80 com botão 48 em
// (20, 16); stories 24 abaixo; lista com recuo 24 e gap 16.
const BACK_BUTTON_SIZE = 48;
const LIST_GAP = 16;
// Espaço para a tab bar que continua visível (divergência #1).
const LIST_BOTTOM_PADDING = 120;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

/**
 * Tela de feed compartilhada (F6) entre cliente e lojista. Carrega feed,
 * stories e lojas seguidas a cada foco (reflete o post recém-publicado), toca
 * o vídeo só do card mais visível e abre o StoryViewer pelos anéis.
 *
 * Lojista: "Seu story" abre a câmera, sem "Agendar" e sem "Seguir" nos posts
 * próprios. Cliente: "Agendar" abre a loja.
 */
export const FeedScreen: React.FC<FeedScreenProps> = ({ role, initialBusinessId }) => {
  const feed = useFeedService();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { businessProfile } = useBusinessProfile();
  const isMerchant = role === 'merchant';
  const ownBusinessId = isMerchant ? (businessProfile?.id ?? null) : null;

  const [status, setStatus] = useState<Status>('loading');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState<FeedStoryGroup[]>([]);
  const [following, setFollowing] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewerGroup, setViewerGroup] = useState<FeedStoryGroup | null>(null);
  const openedInitialRef = useRef(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [nextPosts, nextStories, nextFollowing] = await Promise.all([
        feed.listFeed(),
        feed.listStories(),
        feed.listFollowing(),
      ]);
      setPosts(nextPosts);
      setStories(nextStories);
      setFollowing(new Set(nextFollowing));
      setActiveId((current) =>
        current && nextPosts.some((p) => p.id === current) ? current : (nextPosts[0]?.id ?? null),
      );
      setStatus('ready');

      if (!openedInitialRef.current && initialBusinessId != null) {
        openedInitialRef.current = true;
        const group = nextStories.find((g) => g.author.businessId === initialBusinessId);
        if (group) setViewerGroup(group);
      }
    } catch {
      setStatus('error');
    }
  }, [feed, initialBusinessId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.item) setActiveId((first.item as FeedPost).id);
  }).current;

  const ringGroups = useMemo(
    () => stories.filter((g) => g.author.businessId !== ownBusinessId),
    [stories, ownBusinessId],
  );

  const ownStory =
    isMerchant && businessProfile
      ? {
          author: toFeedAuthor(businessProfile),
          active: stories.some((g) => g.author.businessId === businessProfile.id),
        }
      : null;

  const handleLike = async (postId: string) => {
    try {
      const { liked, likeCount } = await feed.toggleLike(postId);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likedByMe: liked, likeCount } : p)),
      );
    } catch {
      // Post sumiu do mock entre o load e o toque: recarrega o feed.
      load();
    }
  };

  const handleToggleFollow = async (businessId: number) => {
    const next = !following.has(businessId);
    await feed.setFollowing(businessId, next);
    setFollowing((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(businessId);
      else copy.delete(businessId);
      return copy;
    });
  };

  const handleShare = (post: FeedPost) => {
    Share.share({
      message: `Confira a publicação de ${post.author.handle} (${post.author.name}) no Wall to All.`,
    }).catch(() => undefined);
  };

  const renderItem = ({ item }: { item: FeedPost }) => {
    const isOwn = ownBusinessId != null && item.author.businessId === ownBusinessId;
    return (
      <FeedPostCard
        post={item}
        isActive={item.id === activeId}
        following={following.has(item.author.businessId)}
        showFollow={!isOwn}
        onToggleFollow={() => handleToggleFollow(item.author.businessId)}
        onLike={() => handleLike(item.id)}
        onSchedule={
          isMerchant ? undefined : () => router.push(`/(client)/store/${item.author.businessId}`)
        }
        onShare={() => handleShare(item)}
      />
    );
  };

  const header = (
    <View style={styles.storiesArea}>
      <FeedStoriesRow
        groups={ringGroups}
        ownStory={ownStory}
        onPressGroup={setViewerGroup}
        onPressOwn={() => router.push('/(merchant)/feed/record')}
      />
    </View>
  );

  let body: React.ReactNode;
  if (status === 'loading' && posts.length === 0) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.contentLight} />
      </View>
    );
  } else if (status === 'error') {
    body = (
      <View style={styles.center}>
        <Text style={styles.message}>Não foi possível carregar o feed.</Text>
        <Pressable accessibilityRole="button" onPress={load} style={styles.retryButton}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.message}>Nenhuma publicação ainda</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.feedGradientTop, colors.brand]} style={styles.background} />
      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Icon name="chevron-left" size={24} color={colors.contentLight} />
        </Pressable>
      </View>
      {body}
      <StoryViewer
        visible={viewerGroup !== null}
        group={viewerGroup}
        onClose={() => setViewerGroup(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: BACK_BUTTON_SIZE / 2,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  storiesArea: {
    marginTop: 8,
    marginBottom: 24,
    marginHorizontal: -24,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: LIST_BOTTOM_PADDING,
  },
  separator: {
    height: LIST_GAP,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  message: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.contentLight,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.accent,
  },
  retryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.contentLight,
  },
});
