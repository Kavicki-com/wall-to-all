// F4 (QI): dados 100% dos mocks (QiService + WalletService); a unificação com o
// backend é F-futuro.
import React from 'react';
import { QiWithdrawScreen } from '../../../components/qi/QiWithdrawScreen';

/**
 * Solicitar saque do QI do LOJISTA (F4, Task 12; Figma 🆕 `2715:3711`, node do
 * QI `2628:6373`, loading `2628:6464`, modal `2628:6463`). Rota FINA: a tela
 * inteira (carga de resumo/regras/chaves, estados de carga e de erro, e o
 * `WithdrawFlow` compartilhado) vive no `QiWithdrawScreen`, espelhado com o
 * cliente; aqui só se injeta o lado, que seleciona tanto as fixtures do
 * QiService quanto o grupo de rotas do cadastro de chave Pix.
 *
 * Atenção: o saldo daqui é o do PROGRAMA QI (`getQiSummary('merchant')`), não o
 * do Financeiro (`getMerchantBalanceCents`) que a rota
 * `app/(merchant)/financeiro/withdraw.tsx` exibe. São dois saldos independentes,
 * sacados pelo mesmo formulário compartilhado.
 */
const MerchantQiWithdrawScreen: React.FC = () => <QiWithdrawScreen side="merchant" />;

export default MerchantQiWithdrawScreen;
