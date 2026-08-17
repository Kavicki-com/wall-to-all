// F4 (QI): dados 100% do QiService mock; a unificação com o backend é F-futuro.
import React from 'react';
import { QiScreen } from '../../../components/qi/QiScreen';
import { CLIENT_DRAWER_ITEMS } from '../../../components/layout/clientDrawerItems';

// Título da seção de indicados do cliente (Figma node 2628:6934).
const INDICADOS_TITLE = 'Amigos indicados';

// Subtítulo do card de código: muda entre o estado completo e o vazio (Figma
// nodes 2628:6975 completo / 2628:7084 vazio).
const SHARE_SUBTITLE_COMPLETE = 'Convide amigos e ganhe 50% sobre as mensalidades';
const SHARE_SUBTITLE_EMPTY = 'Convide amigos e receba cashback no PIX';

// Mensagem da lista "Amigos indicados" sem indicações (Figma node 2628:7090).
const INDICADOS_EMPTY_MESSAGE =
  'Você ainda não fez nenhuma indicação, compartilhe seu código QI para ganhar mais.';

/**
 * Tela do programa QI do CLIENTE (F4, Task 8, Figma nodes 2628:6934 completo e
 * 2628:7044 vazio). Rota FINA: a casca inteira (hero, cards, lista paginada,
 * estados de carga/erro/vazio, share, navegação) vive no QiScreen compartilhado
 * com o lojista; aqui só se injeta o lado, o menu e a copy do cliente.
 */
const ClientQiScreen: React.FC = () => (
  <QiScreen
    side="client"
    drawerItems={CLIENT_DRAWER_ITEMS}
    indicadosTitle={INDICADOS_TITLE}
    shareSubtitleComplete={SHARE_SUBTITLE_COMPLETE}
    shareSubtitleEmpty={SHARE_SUBTITLE_EMPTY}
    indicadosEmptyMessage={INDICADOS_EMPTY_MESSAGE}
  />
);

export default ClientQiScreen;
