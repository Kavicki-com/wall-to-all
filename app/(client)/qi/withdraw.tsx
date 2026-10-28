// F4 (QI): dados 100% dos mocks (QiService + WalletService); a unificação com o
// backend é F-futuro.
import React from 'react';
import { QiWithdrawScreen } from '../../../components/qi/QiWithdrawScreen';

/**
 * Solicitar saque do QI do CLIENTE (F4, Task 12; Figma 🆕 `2715:3711`, node do
 * QI `2628:6373`, loading `2628:7300`, modal `2628:7299`). Rota FINA: a tela
 * inteira (carga de resumo/regras/chaves, estados de carga e de erro, e o
 * `WithdrawFlow` compartilhado) vive no `QiWithdrawScreen`, espelhado com o
 * lojista; aqui só se injeta o lado, que seleciona tanto as fixtures do
 * QiService quanto o grupo de rotas do cadastro de chave Pix.
 */
const ClientQiWithdrawScreen: React.FC = () => <QiWithdrawScreen side="client" />;

export default ClientQiWithdrawScreen;
