/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock */
import React from 'react';
import { Share } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { FeedScreen } from '../components/feed/FeedScreen';
import { MockFeedService } from '../lib/services/mock/mockFeedService';
import type { FeedService } from '../lib/services/feedTypes';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

let mockProfile: { id: number; business_name: string; logo_url: string | null } | null = null;
jest.mock('../context/BusinessProfileContext', () => ({
  useBusinessProfile: () => ({
    businessProfile: mockProfile,
    loading: false,
    error: null,
    refreshBusinessProfile: async () => undefined,
  }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  mockProfile = null;
});

function renderFeed(
  props: React.ComponentProps<typeof FeedScreen>,
  feed: FeedService = new MockFeedService(),
) {
  return renderWithProviders(<FeedScreen {...props} />, { feed });
}

describe('FeedScreen (cliente)', () => {
  it('lista os cards na ordem do feed, sem "Seu story"', async () => {
    renderFeed({ role: 'client' });
    await screen.findAllByLabelText('Agendar');
    expect(screen.getAllByText(/^@/).map((n) => n.props.children)).toEqual([
      '@anaCabelos',
      '@zaraModa',
      '@varejoSilva',
      '@mixMagazine',
      '@bellaBoutique',
      '@anaCabelos',
    ]);
    expect(screen.queryByText('Seu story')).toBeNull();
  });

  it('"Agendar" abre a loja e voltar chama router.back', async () => {
    renderFeed({ role: 'client' });
    const [schedule] = await screen.findAllByLabelText('Agendar');
    fireEvent.press(schedule);
    expect(mockPush).toHaveBeenCalledWith('/(client)/store/101');

    fireEvent.press(screen.getByLabelText('Voltar'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('initialBusinessId com story abre o visualizador', async () => {
    renderFeed({ role: 'client', initialBusinessId: 102 });
    expect(await screen.findByTestId('story-photo')).toBeTruthy();
    expect(screen.getByText('Coleção nova chegando na loja.')).toBeTruthy();
  });

  it('initialBusinessId sem story mostra só o feed', async () => {
    renderFeed({ role: 'client', initialBusinessId: 999 });
    await screen.findAllByLabelText('Agendar');
    expect(screen.queryByTestId('story-photo')).toBeNull();
  });

  it('tocar um anel abre o visualizador daquele grupo', async () => {
    renderFeed({ role: 'client' });
    fireEvent.press(await screen.findByLabelText('Stories de Mix Magazine'));
    expect(await screen.findByText('Vitrine montada, venha conferir!')).toBeTruthy();
  });

  it('curtir atualiza o botão e o serviço', async () => {
    const feed = new MockFeedService();
    renderFeed({ role: 'client' }, feed);
    const likes = await screen.findAllByLabelText('Curtir');
    fireEvent.press(likes[1]);
    await waitFor(() => expect(screen.getAllByLabelText('Descurtir')).toHaveLength(1));
    expect(screen.getByText('1,2k')).toBeTruthy();
    const post = (await feed.listFeed()).find((p) => p.id === 'fx-2')!;
    expect(post.likedByMe).toBe(true);
    expect(post.likeCount).toBe(1251);
  });

  it('seguir alterna para "Seguindo" e persiste no serviço', async () => {
    const feed = new MockFeedService();
    renderFeed({ role: 'client' }, feed);
    const [follow] = await screen.findAllByText('Seguir');
    fireEvent.press(follow);
    // Os dois posts da Ana Cabelos (101) passam a "Seguindo".
    await waitFor(() => expect(screen.getAllByText('Seguindo')).toHaveLength(2));
    expect(await feed.listFollowing()).toContain(101);
  });

  it('compartilhar chama Share.share com o handle', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    renderFeed({ role: 'client' });
    const [button] = await screen.findAllByLabelText('Compartilhar');
    fireEvent.press(button);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0]).toEqual(
      expect.objectContaining({ message: expect.stringContaining('@anaCabelos') }),
    );
    share.mockRestore();
  });

  it('erro mostra mensagem e "Tentar novamente" recarrega', async () => {
    const feed = new MockFeedService();
    jest.spyOn(feed, 'listFeed').mockRejectedValueOnce(new Error('falhou'));
    renderFeed({ role: 'client' }, feed);
    expect(await screen.findByText('Não foi possível carregar o feed.')).toBeTruthy();
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(await screen.findAllByLabelText('Agendar')).toHaveLength(6);
  });

  it('feed vazio mostra "Nenhuma publicação ainda"', async () => {
    const empty: FeedService = {
      listFeed: async () => [],
      listStories: async () => [],
      listCategories: async () => [],
      publishPost: async () => {
        throw new Error('não usado');
      },
      toggleLike: async () => ({ liked: false, likeCount: 0 }),
      listFollowing: async () => [],
      setFollowing: async () => undefined,
    };
    renderFeed({ role: 'client' }, empty);
    expect(await screen.findByText('Nenhuma publicação ainda')).toBeTruthy();
  });
});

describe('FeedScreen (lojista)', () => {
  beforeEach(() => {
    mockProfile = { id: 101, business_name: 'Ana Cabelos', logo_url: null };
  });

  it('"Seu story" ativo leva à câmera; sem "Agendar"; sem "Seguir" nos próprios posts', async () => {
    renderFeed({ role: 'merchant' });
    await screen.findAllByLabelText('Curtir');

    expect(screen.getByTestId('own-story-ring-active')).toBeTruthy();
    expect(screen.queryByLabelText('Stories de Ana Cabelos')).toBeNull();
    fireEvent.press(screen.getByLabelText('Seu story'));
    expect(mockPush).toHaveBeenCalledWith('/(merchant)/feed/record');

    expect(screen.queryByText('Agendar')).toBeNull();
    // 6 posts, 2 da própria loja (101): 4 botões "Seguir".
    expect(screen.getAllByText('Seguir')).toHaveLength(4);
  });
});
