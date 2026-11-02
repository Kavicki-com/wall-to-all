import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { PostComposer } from '../../../components/feed/PostComposer';
import { useBusinessProfile } from '../../../context/BusinessProfileContext';
import { toFeedAuthor } from '../../../lib/feed/author';
import { colors } from '../../../lib/theme';
import { MAX_VIDEO_SECONDS, type FeedMediaType } from '../../../lib/services/feedTypes';

const FEED_ROUTE = '/(merchant)/feed';
// Espaço para a tab bar que continua visível (mesmo valor do FeedScreen).
const BOTTOM_PADDING = 120;

type PreviewParams = { uri?: string; type?: string; duration?: string };
type ValidMedia = { uri: string; type: FeedMediaType; durationSec: number | null };

/** Valida os params vindos da câmera; null quando não dá para publicar. */
function parseMedia(uri?: string, type?: string, duration?: string): ValidMedia | null {
  if (!uri) return null;
  if (type === 'photo') return { uri, type, durationSec: null };
  if (type !== 'video') return null;
  const seconds = Number(duration);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_VIDEO_SECONDS) return null;
  return { uri, type, durationSec: seconds };
}

/**
 * Pré-visualização e publicação do post do lojista (F6). Header com Voltar
 * (divergência #2); params inválidos voltam direto ao feed.
 */
export default function MerchantFeedPreviewRoute() {
  const router = useRouter();
  const { uri, type, duration } = useLocalSearchParams<PreviewParams>();
  const { businessProfile } = useBusinessProfile();
  const media = useMemo(() => parseMedia(uri, type, duration), [uri, type, duration]);

  useEffect(() => {
    if (!media) router.replace(FEED_ROUTE);
  }, [media, router]);

  if (!media) return null;

  const backToFeed = () => router.replace(FEED_ROUTE);

  return (
    <ScreenContainer
      scroll
      header={<AppHeader showBackButton onPressBack={() => router.back()} />}
      horizontalPadding={20}
      backgroundColor={colors.background}
      contentContainerStyle={styles.content}
    >
      {businessProfile ? (
        <PostComposer
          author={toFeedAuthor(businessProfile)}
          mediaType={media.type}
          mediaUri={media.uri}
          durationSec={media.durationSec}
          onPublished={backToFeed}
          onSeeAll={backToFeed}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    paddingBottom: BOTTOM_PADDING,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
