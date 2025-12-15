import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

/**
 * Hook para navegar para trás de forma segura, verificando se há histórico.
 * Este hook deve ser usado dentro de componentes React.
 * 
 * @param fallbackRoute - Rota para redirecionar se não houver histórico (padrão: '/(client)/home')
 * @returns Função para navegar para trás de forma segura
 */
export const useSafeGoBack = (fallbackRoute: string = '/(client)/home') => {
  const navigation = useNavigation();

  return useCallback(() => {
    // Verifica se o navegador pode voltar usando a API do React Navigation
    const canGoBack = navigation.canGoBack();
    
    if (canGoBack) {
      // Tenta navegar para trás
      // O React Navigation vai logar um warning se não houver tela, mas não vai quebrar
      router.back();
    } else {
      // Se não há histórico, redireciona para a rota de fallback
      router.replace(fallbackRoute as never);
    }
  }, [navigation, fallbackRoute]);
};

/**
 * Navega para trás de forma segura, evitando erros quando não há histórico.
 * 
 * NOTA: Esta função não pode verificar o histórico diretamente sem hooks.
 * Para uma verificação mais robusta, use o hook useSafeGoBack() dentro de componentes.
 * 
 * Esta função tenta usar router.back() mas se houver erro (que será logado como warning),
 * você deve usar useSafeGoBack() em vez disso para uma verificação adequada.
 * 
 * @param fallbackRoute - Rota para redirecionar se não houver histórico (padrão: '/(client)/home')
 */
export const safeGoBack = (fallbackRoute: string = '/(client)/home') => {
  // Como não temos acesso ao navigation sem hooks, vamos tentar uma abordagem diferente:
  // Verificar se estamos na rota raiz ou em uma rota que não deveria ter histórico
  // Se sim, redireciona para o fallback em vez de tentar voltar
  
  // Tenta navegar para trás
  // O React Navigation vai logar um warning em desenvolvimento se não houver histórico,
  // mas não vai quebrar a aplicação. Em produção, o warning não aparece.
  // 
  // Para evitar o warning em desenvolvimento, use useSafeGoBack() em componentes React.
  try {
    router.back();
  } catch (error) {
    // Se houver uma exceção (improvável, mas possível), redireciona para o fallback
    console.warn('Erro ao voltar, redirecionando para:', fallbackRoute);
    router.replace(fallbackRoute as never);
  }
};

