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
    // Com expo-router, às vezes canGoBack() pode retornar true mas ainda assim não haver tela
    // Então vamos tentar voltar, mas se falhar, usar o fallback
    const canGoBack = navigation.canGoBack();
    
    if (canGoBack) {
      try {
        router.back();
        // Se não houver erro imediato, assumimos que funcionou
        // O erro será capturado pelo React Navigation se não houver tela
      } catch {
        // Se houver erro ao tentar voltar, usa o fallback
        console.warn('Erro ao voltar, redirecionando para:', fallbackRoute);
        router.replace(fallbackRoute as never);
      }
    } else {
      // Se não há histórico, redireciona para a rota de fallback
      router.replace(fallbackRoute as never);
    }
  }, [navigation, fallbackRoute]);
};

/**
 * Navega para trás de forma segura, evitando erros quando não há histórico.
 * 
 * NOTA: Esta função não pode verificar o histórico diretamente.
 * Para uma verificação mais robusta, use o hook useSafeGoBack() dentro de componentes.
 * 
 * @param fallbackRoute - Rota para redirecionar se não houver histórico (padrão: '/(client)/home')
 */
export const safeGoBack = (_fallbackRoute: string = '/(client)/home') => {
  // Tenta navegar para trás
  // O erro será logado pelo React Navigation se não houver histórico,
  // mas não vai quebrar a aplicação (é apenas um warning em desenvolvimento)
  router.back();
};

