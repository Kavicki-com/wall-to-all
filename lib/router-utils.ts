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
 * Para evitar o erro "GO_BACK was not handled", sempre redireciona para o fallback.
 * 
 * Para uma verificação mais robusta que tenta voltar quando há histórico,
 * use o hook useSafeGoBack() dentro de componentes React.
 * 
 * @param fallbackRoute - Rota para redirecionar se não houver histórico (padrão: '/(client)/home')
 */
export const safeGoBack = (fallbackRoute: string = '/(client)/home') => {
  // Como não temos acesso ao navigation state sem hooks, sempre redirecionamos
  // para o fallback para evitar o erro "GO_BACK was not handled".
  // Isso garante que não haverá warning em desenvolvimento.
  // Se você precisar do comportamento de voltar quando houver histórico, use useSafeGoBack().
  router.replace(fallbackRoute as never);
};

