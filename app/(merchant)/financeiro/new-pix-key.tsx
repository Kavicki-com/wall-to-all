import React from 'react';
import { useRouter } from 'expo-router';
import { PixKeyForm } from '../../../components/wallet/PixKeyForm';

/**
 * Cadastro de nova chave Pix do LOJISTA (Figma node 2597:6009). Wrapper fino de
 * rota: delega todo o layout/lógica ao `PixKeyForm` compartilhado, injetando só o
 * `onSaved` (volta para o financeiro após o cadastro persistir). A rota é
 * registrada na Task 8 — este arquivo existe agora, mas ainda não é navegável.
 */
const NewPixKeyScreen: React.FC = () => {
  const router = useRouter();
  return <PixKeyForm onSaved={() => router.back()} />;
};

export default NewPixKeyScreen;
