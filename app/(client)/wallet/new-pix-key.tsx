import React from 'react';
import { useRouter } from 'expo-router';
import { PixKeyForm } from '../../../components/wallet/PixKeyForm';

/**
 * Cadastro de nova chave Pix do CLIENTE (Figma node 2660:6529). Wrapper fino de
 * rota: delega todo o layout/lógica ao `PixKeyForm` compartilhado, injetando só o
 * `onSaved` (volta para a carteira após o cadastro persistir).
 */
const NewPixKeyScreen: React.FC = () => {
  const router = useRouter();
  return <PixKeyForm onSaved={() => router.back()} />;
};

export default NewPixKeyScreen;
