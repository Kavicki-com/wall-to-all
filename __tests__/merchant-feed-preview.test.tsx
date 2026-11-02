/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock */
import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import PreviewRoute from '../app/(merchant)/feed/preview';
import { MockFeedService } from '../lib/services/mock/mockFeedService';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
  };
});

// AppHeader puxa Auth/Notifications; o stub expõe só o "Voltar".
jest.mock('../components/layout/AppHeader', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      showBackButton,
      onPressBack,
    }: {
      showBackButton?: boolean;
      onPressBack?: () => void;
    }) =>
      showBackButton
        ? React.createElement(
            Pressable,
            { accessibilityLabel: 'Voltar', onPress: onPressBack },
            React.createElement(Text, null, 'Voltar'),
          )
        : null,
  };
});

const mockProfile = { id: 101, business_name: 'Ana Cabelos', logo_url: null };
jest.mock('../context/BusinessProfileContext', () => ({
  useBusinessProfile: () => ({
    businessProfile: mockProfile,
    loading: false,
    error: null,
    refreshBusinessProfile: async () => undefined,
  }),
}));

let mockServicesResult: { data: unknown; error: unknown } = { data: [], error: null };
jest.mock('../lib/supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve(mockServicesResult);
  return { supabase: { from: () => builder } };
});

const SERVICES = [
  { id: 7, name: 'Corte feminino', price: 80, duration_minutes: 60 },
  { id: 8, name: 'Escova', price: 45, duration_minutes: 30 },
];
const VIDEO_PARAMS = { uri: 'file:///v.mp4', type: 'video', duration: '24' };
const FEED = '/(merchant)/feed';

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  mockParams = { ...VIDEO_PARAMS };
  mockServicesResult = { data: SERVICES, error: null };
});

/** Renderiza e espera serviços e categorias carregarem. */
async function renderPreview(feed = new MockFeedService()) {
  const result = renderWithProviders(<PreviewRoute />, { feed });
  await screen.findByRole('button', { name: 'Cabelo' });
  await screen.findByLabelText('Alterar serviço');
  return { ...result, feed };
}

describe('preview do post (lojista)', () => {
  it('vídeo: player com duração, categorias e serviço padrão', async () => {
    await renderPreview();
    expect(screen.getByTestId('composer-video')).toBeTruthy();
    expect(screen.getByText('00:24 / 00:30')).toBeTruthy();

    const chips = within(screen.getByTestId('category-chips')).getAllByRole('button');
    expect(chips.map((c) => within(c).getByText(/./).props.children)).toEqual([
      'Cabelo',
      'Barba',
      'Manicure',
      'Estética',
      'Maquiagem',
      'Outros',
    ]);
    expect(chips[0].props.accessibilityState).toMatchObject({ selected: true });
    expect(chips[1].props.accessibilityState).toMatchObject({ selected: false });

    expect(screen.getByText('Corte feminino')).toBeTruthy();
    expect(screen.getByText('R$ 80,00 • 60 min')).toBeTruthy();
  });

  it('"Alterar" abre a lista e escolher outro troca a linha', async () => {
    await renderPreview();
    fireEvent.press(screen.getByLabelText('Alterar serviço'));
    fireEvent.press(screen.getByLabelText('Vincular Escova'));
    expect(screen.queryByLabelText('Vincular Corte feminino')).toBeNull();
    expect(screen.queryByText('Corte feminino')).toBeNull();
    expect(screen.getByText('Escova')).toBeTruthy();
    expect(screen.getByText('R$ 45,00 • 30 min')).toBeTruthy();
  });

  it('toggles começam como no Figma', async () => {
    await renderPreview();
    expect(screen.getByLabelText('Permitir downloads').props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(
      screen.getByLabelText('Compartilhar com clientes vinculados').props.accessibilityState,
    ).toMatchObject({ checked: true });
  });

  it('publicar envia o post, volta ao feed e o post fica no topo', async () => {
    const { feed } = await renderPreview();
    const original = feed.publishPost.bind(feed);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = jest.spyOn(feed, 'publishPost').mockImplementation(async (input) => {
      await gate;
      return original(input);
    });

    fireEvent.changeText(screen.getByLabelText('Legenda'), 'Fade em 3 etapas');
    fireEvent.press(screen.getByRole('button', { name: 'Barba' }));
    fireEvent.press(screen.getByLabelText('Permitir downloads'));
    fireEvent.press(screen.getByLabelText('Publicar agora'));

    expect(await screen.findByText('Publicando...')).toBeTruthy();
    expect(screen.getByLabelText('Publicar agora').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await act(async () => {
      release();
    });

    expect(spy).toHaveBeenCalledWith({
      author: { businessId: 101, name: 'Ana Cabelos', handle: '@anaCabelos', logoUrl: null },
      mediaType: 'video',
      mediaUri: 'file:///v.mp4',
      durationSec: 24,
      caption: 'Fade em 3 etapas',
      category: 'Barba',
      linkedService: {
        serviceId: 7,
        name: 'Corte feminino',
        priceCents: 8000,
        durationMinutes: 60,
      },
      allowDownloads: true,
      shareWithLinkedClients: true,
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(FEED));
    const [top] = await feed.listFeed();
    expect(top.caption).toBe('Fade em 3 etapas');
    expect(top.mediaUri).toBe('file:///v.mp4');
  });

  it('falha ao publicar mostra o erro e o botão volta', async () => {
    const { feed } = await renderPreview();
    jest.spyOn(feed, 'publishPost').mockRejectedValue(new Error('rede'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Publicar agora'));
    });

    expect(screen.getByText('Não foi possível publicar. Tente novamente.')).toBeTruthy();
    expect(screen.getByText('Publicar agora')).toBeTruthy();
    expect(screen.getByLabelText('Publicar agora').props.accessibilityState).toMatchObject({
      disabled: false,
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('lojista sem serviços publica sem vínculo', async () => {
    mockServicesResult = { data: [], error: null };
    const feed = new MockFeedService();
    renderWithProviders(<PreviewRoute />, { feed });
    expect(await screen.findByText('Nenhum serviço cadastrado')).toBeTruthy();
    expect(screen.queryByLabelText('Alterar serviço')).toBeNull();
    const spy = jest.spyOn(feed, 'publishPost');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Publicar agora'));
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ linkedService: null }));
  });

  it('erro ao carregar serviços avisa e publica sem vínculo', async () => {
    mockServicesResult = { data: null, error: { message: 'boom' } };
    const feed = new MockFeedService();
    renderWithProviders(<PreviewRoute />, { feed });
    expect(await screen.findByText('Não foi possível carregar seus serviços.')).toBeTruthy();
    const spy = jest.spyOn(feed, 'publishPost');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Publicar agora'));
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ linkedService: null }));
  });

  it('foto: mostra a imagem, sem duração', async () => {
    mockParams = { uri: 'file:///p.jpg', type: 'photo' };
    const { feed } = await renderPreview();
    expect(screen.getByTestId('composer-photo')).toBeTruthy();
    expect(screen.queryByTestId('composer-video')).toBeNull();
    expect(screen.queryByText(/\/ 00:30$/)).toBeNull();
    const spy = jest.spyOn(feed, 'publishPost');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Publicar agora'));
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'photo', mediaUri: 'file:///p.jpg', durationSec: null }),
    );
  });

  it('"Ver todos" volta ao feed sem publicar', async () => {
    const { feed } = await renderPreview();
    const spy = jest.spyOn(feed, 'publishPost');
    fireEvent.press(screen.getByLabelText('Ver todos'));
    expect(mockReplace).toHaveBeenCalledWith(FEED);
    expect(spy).not.toHaveBeenCalled();
  });

  it('"Voltar" do header volta para a câmera', async () => {
    await renderPreview();
    fireEvent.press(screen.getByLabelText('Voltar'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sem uri', { type: 'video', duration: '10' }],
    ['tipo desconhecido', { uri: 'file:///x', type: 'gif' }],
    ['vídeo acima de 30 s', { uri: 'file:///v.mp4', type: 'video', duration: '31' }],
    ['vídeo sem duração', { uri: 'file:///v.mp4', type: 'video' }],
  ])('params inválidos (%s) voltam ao feed', async (_label, params) => {
    mockParams = params;
    renderWithProviders(<PreviewRoute />, { feed: new MockFeedService() });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(FEED));
    expect(screen.queryByLabelText('Publicar agora')).toBeNull();
  });
});
