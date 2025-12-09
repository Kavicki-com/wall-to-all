import { router } from 'expo-router';

/**
 * Navega para trás de forma segura, evitando erros quando não há histórico.
 * Se não houver histórico de navegação, redireciona para a rota de fallback.
 * 
 * @param fallbackRoute - Rota para redirecionar se não houver histórico (padrão: '/(client)/home')
 */
export const safeGoBack = (fallbackRoute: string = '/(client)/home') => {
  try {
    // Tenta navegar para trás
    router.back();
  } catch (error) {
    // Se houver erro (não há histórico), redireciona para a rota de fallback
    console.warn('Não há histórico de navegação, redirecionando para:', fallbackRoute);
    router.replace(fallbackRoute as any);
  }
};

