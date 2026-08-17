import React from 'react';
import { useRouter } from 'expo-router';
import { PixKeyForm } from '../../../components/wallet/PixKeyForm';

/**
 * Cadastro de nova chave Pix a partir do SAQUE DO QI do LOJISTA (F4, Task 12;
 * Figma node 2597:6009, o mesmo do Financeiro). Wrapper fino de rota: delega
 * todo o layout/lógica ao `PixKeyForm` compartilhado, injetando só o `onSaved`
 * (volta ao saque do QI depois que o cadastro persiste; o `useFocusEffect` de lá
 * recarrega as chaves, e a recém-criada já aparece selecionável).
 *
 * A chave pertence ao WalletService, não ao QI (decisão de arquitetura da fase:
 * a mesma chave Pix vale em todo o app). Esta rota existe em separado da
 * `financeiro/new-pix-key` só para que o `onSaved`/"Voltar" retorne ao saque do
 * QI, e não ao Financeiro.
 */
const NewPixKeyScreen: React.FC = () => {
  const router = useRouter();
  return <PixKeyForm onSaved={() => router.back()} />;
};

export default NewPixKeyScreen;
