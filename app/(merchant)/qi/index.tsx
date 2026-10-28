// F4 (QI): dados 100% do QiService mock; a unificação com o backend é F-futuro.
import React from 'react';
import { QiScreen } from '../../../components/qi/QiScreen';
import { MERCHANT_DRAWER_ITEMS } from '../../../components/layout/merchantDrawerItems';

// Título da seção de indicadas. DIVERGÊNCIA deliberada do Figma (documentada
// p/ o revisor): o node 2606:5522 (completo) traz "Suas indicados" (erro de
// concordância do design) e o 2606:6297 (vazio) traz "Suas indicações". O
// plano (Task 9) fixa o rótulo único "Suas indicadas", que corrige a
// concordância e mantém um título só para os dois estados, como no cliente.
const INDICADOS_TITLE = 'Suas indicadas';

// Subtítulo do card de código: muda entre o estado completo e o vazio (Figma
// nodes 2606:5515 completo / 2606:6290 vazio, mesma copy do cliente).
const SHARE_SUBTITLE_COMPLETE = 'Convide amigos e ganhe 50% sobre as mensalidades';
const SHARE_SUBTITLE_EMPTY = 'Convide amigos e receba cashback no PIX';

// Mensagem da seção "Suas indicadas" sem indicações (Figma node 2606:6377,
// mesma copy do cliente).
const INDICADOS_EMPTY_MESSAGE =
  'Você ainda não fez nenhuma indicação, compartilhe seu código QI para ganhar mais.';

/**
 * Tela do programa QI do LOJISTA (F4, Task 9, Figma nodes 2606:5475 completo e
 * 2606:6250 vazio). Rota FINA: a casca inteira (hero, cards, lista paginada,
 * estados de carga/erro/vazio, share, navegação) vive no QiScreen compartilhado
 * com o cliente; aqui só se injeta o lado, o menu e a copy do lojista.
 */
const MerchantQiScreen: React.FC = () => (
  <QiScreen
    side="merchant"
    drawerItems={MERCHANT_DRAWER_ITEMS}
    indicadosTitle={INDICADOS_TITLE}
    shareSubtitleComplete={SHARE_SUBTITLE_COMPLETE}
    shareSubtitleEmpty={SHARE_SUBTITLE_EMPTY}
    indicadosEmptyMessage={INDICADOS_EMPTY_MESSAGE}
  />
);

export default MerchantQiScreen;
