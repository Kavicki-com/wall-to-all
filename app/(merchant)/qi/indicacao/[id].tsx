// F4 (QI): dados 100% do QiService mock; a unificação com o backend é F-futuro.
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { QiIndicacaoDetails } from '../../../../components/qi/QiIndicacaoDetails';

/**
 * Detalhes da indicação do LOJISTA (F4, Task 11, Figma node 2606:5546). Rota
 * FINA: espelho exato da rota do cliente, inclusive de copy (a tela
 * compartilhada não precisou de nenhuma prop de texto); aqui só se injetam o
 * lado e o `[id]` da rota.
 *
 * `id` ausente (rota montada sem parâmetro) vira string vazia: o serviço
 * rejeita, e a tela compartilhada mostra o toast de erro e volta pela pilha,
 * exatamente como faz com um id inexistente.
 */
const MerchantQiIndicacaoScreen: React.FC = () => {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return <QiIndicacaoDetails side="merchant" id={id ?? ''} />;
};

export default MerchantQiIndicacaoScreen;
