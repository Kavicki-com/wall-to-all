import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

// Rota de fallback para antigas navegações "services/index".
// Redireciona o usuário para a tela principal de busca.
const ClientServicesRedirect = () => {
  useEffect(() => {
    router.replace('/(client)/home/index');
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#E5102E" />
    </View>
  );
};

export default ClientServicesRedirect;

