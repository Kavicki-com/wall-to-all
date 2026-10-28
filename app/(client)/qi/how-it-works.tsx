// F4 (QI): dados 100% do QiService mock; a unificação com o backend é F-futuro.
import React from 'react';
import { QiHowItWorks } from '../../../components/qi/QiHowItWorks';

/**
 * "Como funciona o QI" do CLIENTE (F4, Task 11, Figma node 2628:7226). Rota
 * FINA: a tela inteira (cabeçalho, passos numerados, cards de ganho e de
 * regras, share, estados de carga e de erro) vive no `QiHowItWorks`
 * compartilhado com o lojista; aqui só se injeta o lado.
 */
const ClientQiHowItWorksScreen: React.FC = () => <QiHowItWorks side="client" />;

export default ClientQiHowItWorksScreen;
