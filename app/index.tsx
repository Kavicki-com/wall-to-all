import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../lib/theme';

const IndexScreen: React.FC = () => {
  // O MainLayout no _layout.tsx cuida de todo o redirecionamento
  // Esta tela apenas mostra um loading enquanto o redirecionamento acontece
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F2' }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
};

export default IndexScreen;

