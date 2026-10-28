// F4 (QI): dados 100% do QiService mock; a unificação com o backend é F-futuro.
import React from 'react';
import { QiHowItWorks } from '../../../components/qi/QiHowItWorks';

/**
 * "Como funciona o QI" do LOJISTA (F4, Task 11, Figma node 2606:5632). Rota
 * FINA: espelho exato da rota do cliente, inclusive de copy (a tela
 * compartilhada não precisou de nenhuma prop de texto); aqui só se injeta o
 * lado.
 */
const MerchantQiHowItWorksScreen: React.FC = () => <QiHowItWorks side="merchant" />;

export default MerchantQiHowItWorksScreen;
