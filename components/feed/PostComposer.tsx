import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Icon } from '../ui/Icon';
import { Chip } from '../ui/Chip';
import { Toggle } from '../ui/Toggle';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import { formatClock } from '../../lib/feed/format';
import { fetchLinkableServices } from '../../lib/feed/merchantServices';
import { useFeedService } from '../../context/ServicesContext';
import {
  MAX_CAPTION_LENGTH,
  MAX_VIDEO_SECONDS,
  type FeedAuthor,
  type FeedLinkedService,
  type FeedMediaType,
} from '../../lib/services/feedTypes';

export interface PostComposerProps {
  author: FeedAuthor;
  mediaType: FeedMediaType;
  mediaUri: string;
  /** Segundos do vídeo; null para foto. */
  durationSec: number | null;
  /** Chamado depois que o post foi publicado. */
  onPublished: () => void;
  /** "Ver todos": volta ao feed sem publicar. */
  onSeeAll: () => void;
}

type ServicesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; list: FeedLinkedService[] };

// Figma preview-post (2502:396): corpo com recuo 20 e gap 24; mídia 200 de
// altura com raio 16; play 56; legenda 119 (rótulo + caixa); CTA 52.
const MEDIA_HEIGHT = 200;
const PLAY_SIZE = 56;
const CAPTION_BOX_HEIGHT = 100;
const CTA_HEIGHT = 52;

const serviceMeta = (s: FeedLinkedService) =>
  `${formatBRL(s.priceCents)} • ${s.durationMinutes} min`;

/** Player do preview: começa pausado; o botão central alterna play/pause. */
const ComposerVideo: React.FC<{ uri: string }> = ({ uri }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (playing) {
      player.pause();
    } else {
      player.play();
    }
    setPlaying(!playing);
  };

  return (
    <>
      <VideoView
        testID="composer-video"
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable
        onPress={toggle}
        style={[styles.playButton, playing && styles.playButtonPlaying]}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pausar vídeo' : 'Reproduzir vídeo'}
        hitSlop={8}
      >
        <Icon
          name={playing ? 'pause' : 'play-arrow'}
          family="MaterialIcons"
          size={32}
          color={colors.contentLight}
        />
      </Pressable>
    </>
  );
};

/**
 * Formulário de publicação do feed (F6): pré-visualiza a mídia, recebe
 * legenda, categoria (mock), serviço vinculado (Supabase) e as duas
 * preferências, e publica no `FeedService`.
 */
export const PostComposer: React.FC<PostComposerProps> = ({
  author,
  mediaType,
  mediaUri,
  durationSec,
  onPublished,
  onSeeAll,
}) => {
  const feed = useFeedService();
  const [caption, setCaption] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [services, setServices] = useState<ServicesState>({ status: 'loading' });
  const [service, setService] = useState<FeedLinkedService | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [shareWithLinkedClients, setShareWithLinkedClients] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    feed
      .listCategories()
      .then((list) => {
        if (!alive) return;
        setCategories(list);
        setCategory(list[0] ?? null);
      })
      .catch(() => {
        // Categoria é opcional: sem lista, os chips somem e publica com null.
      });
    return () => {
      alive = false;
    };
  }, [feed]);

  useEffect(() => {
    let alive = true;
    fetchLinkableServices(author.businessId)
      .then((list) => {
        if (!alive) return;
        setServices({ status: 'ready', list });
        setService(list[0] ?? null);
      })
      .catch(() => {
        if (alive) setServices({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [author.businessId]);

  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    setPublishError(false);
    try {
      await feed.publishPost({
        author,
        mediaType,
        mediaUri,
        durationSec: mediaType === 'video' ? durationSec : null,
        caption: caption.trim(),
        category,
        linkedService: service,
        allowDownloads,
        shareWithLinkedClients,
      });
      onPublished();
    } catch {
      if (mountedRef.current) {
        setPublishError(true);
        setPublishing(false);
      }
    }
  };

  const chooseService = (next: FeedLinkedService) => {
    setService(next);
    setPickerOpen(false);
  };

  const renderServiceSection = () => {
    if (services.status === 'loading') {
      return <ActivityIndicator color={colors.brand} style={styles.serviceLoading} />;
    }
    if (services.status === 'error') {
      return <Text style={styles.emptyText}>Não foi possível carregar seus serviços.</Text>;
    }
    if (!service) {
      return <Text style={styles.emptyText}>Nenhum serviço cadastrado</Text>;
    }
    return (
      <>
        <View style={styles.serviceRow}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName} numberOfLines={1}>
              {service.name}
            </Text>
            <Text style={styles.serviceMeta}>{serviceMeta(service)}</Text>
          </View>
          <Pressable
            onPress={() => setPickerOpen((open) => !open)}
            style={styles.ghostSmall}
            accessibilityRole="button"
            accessibilityLabel="Alterar serviço"
            accessibilityState={{ expanded: pickerOpen }}
            hitSlop={8}
          >
            <Text style={styles.ghostSmallText}>Alterar</Text>
          </Pressable>
        </View>
        {pickerOpen && (
          <View style={styles.pickerList}>
            {services.list.map((option) => {
              const selected = option.serviceId === service.serviceId;
              return (
                <Pressable
                  key={option.serviceId}
                  onPress={() => chooseService(option)}
                  style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`Vincular ${option.name}`}
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.pickerName} numberOfLines={1}>
                    {option.name}
                  </Text>
                  <Text style={styles.serviceMeta}>{serviceMeta(option)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.mediaGroup}>
        <View style={styles.media}>
          {mediaType === 'video' ? (
            <ComposerVideo uri={mediaUri} />
          ) : (
            <Image
              testID="composer-photo"
              source={{ uri: mediaUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          )}
          {mediaType === 'video' && durationSec != null && (
            <View style={styles.durationPill}>
              <Text style={styles.durationText}>
                {`${formatClock(durationSec)} / ${formatClock(MAX_VIDEO_SECONDS)}`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.captionField}>
          <Text style={styles.captionLabel}>Legenda</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Conte o que aparece no seu post..."
            placeholderTextColor={colors.textMuted}
            style={styles.captionInput}
            multiline
            textAlignVertical="top"
            maxLength={MAX_CAPTION_LENGTH}
            accessibilityLabel="Legenda"
          />
        </View>
      </View>

      <View style={styles.sectionLarge}>
        <Text style={styles.sectionTitle}>Categoria do serviço</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          testID="category-chips"
        >
          {categories.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={item === category}
              onPress={() => setCategory(item)}
              style={styles.chip}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vincular serviço</Text>
        {renderServiceSection()}
      </View>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Permitir downloads</Text>
          <Toggle
            value={allowDownloads}
            onValueChange={setAllowDownloads}
            accessibilityLabel="Permitir downloads"
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Compartilhar com clientes vinculados</Text>
          <Toggle
            value={shareWithLinkedClients}
            onValueChange={setShareWithLinkedClients}
            accessibilityLabel="Compartilhar com clientes vinculados"
          />
        </View>
      </View>

      <View style={styles.section}>
        {publishError && (
          <Text style={styles.errorText}>Não foi possível publicar. Tente novamente.</Text>
        )}
        <Pressable
          onPress={publish}
          disabled={publishing}
          style={[styles.cta, publishing && styles.ctaBusy]}
          accessibilityRole="button"
          accessibilityLabel="Publicar agora"
          accessibilityState={{ disabled: publishing, busy: publishing }}
        >
          <Text style={styles.ctaText}>{publishing ? 'Publicando...' : 'Publicar agora'}</Text>
        </Pressable>
        <Pressable
          onPress={onSeeAll}
          disabled={publishing}
          style={styles.ghost}
          accessibilityRole="button"
          accessibilityLabel="Ver todos"
        >
          <Text style={styles.ghostText}>Ver todos</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  mediaGroup: {
    gap: 16,
  },
  media: {
    height: MEDIA_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.textPrimary,
  },
  playButton: {
    position: 'absolute',
    top: (MEDIA_HEIGHT - PLAY_SIZE) / 2,
    alignSelf: 'center',
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: 24,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tocando, o botão fica discreto para não cobrir o vídeo.
  playButtonPlaying: {
    opacity: 0.4,
  },
  durationPill: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: colors.textPrimary,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
  },
  captionField: {
    gap: 4,
  },
  captionLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.brand,
  },
  captionInput: {
    height: CAPTION_BOX_HEIGHT,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textPrimary,
  },
  sectionLarge: {
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  chips: {
    gap: 8,
  },
  // Figma: chip com recuo 8 em volta e borda navy também quando selecionado.
  chip: {
    paddingHorizontal: 8,
    minHeight: 0,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  serviceLoading: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  serviceInfo: {
    flex: 1,
    gap: 4,
  },
  serviceName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  serviceMeta: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  ghostSmall: {
    paddingVertical: 8,
  },
  ghostSmallText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.brand,
  },
  pickerList: {
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  pickerOptionSelected: {
    backgroundColor: colors.surfacePrimaryExtraLight,
  },
  pickerName: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
  },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    paddingVertical: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  settingLabel: {
    flex: 1,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.error,
    textAlign: 'center',
  },
  cta: {
    height: CTA_HEIGHT,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    elevation: 2,
  },
  ctaBusy: {
    opacity: 0.7,
  },
  ctaText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  ghost: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ghostText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
});
