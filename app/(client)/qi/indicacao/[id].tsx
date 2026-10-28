// F4 (QI): dados 100% do QiService mock; a unificação com o backend é F-futuro.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { QiIndicacaoDetails } from '../../../../components/qi/QiIndicacaoDetails';

/**
 * Detalhes da indicação do CLIENTE (F4, Task 11, Figma node 2628:7149). Rota
 * FINA: a tela inteira (hero, card "Informações", extrato, estados de carga e
 * de erro) vive no `QiIndicacaoDetails` compartilhado com o lojista; aqui só se
 * injetam o lado e o `[id]` da rota.
 *
 * `id` ausente (rota montada sem parâmetro) vira string vazia: o serviço
 * rejeita, e a tela compartilhada mostra o toast de erro e volta pela pilha,
 * exatamente como faz com um id inexistente.
 */
const ClientQiIndicacaoScreen: React.FC = () => {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return <QiIndicacaoDetails side="client" id={id ?? ''} />;
};

export default ClientQiIndicacaoScreen;
