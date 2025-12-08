import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LogoWallToAll } from '../../lib/assets';

const ClientSignupLoadingScreen: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/(client)/home'); // ✅ Corrigido
    }, 1500);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <View style={styles.background}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <LogoWallToAll width={64} height={40} />
        </View>
        <Text style={styles.text}>
          Aguarde, enquanto preparamos tudo para você
        </Text>
      </View>
    </View>
  );
};

export default ClientSignupLoadingScreen;

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoWrapper: {
    marginBottom: 24,
  },
  text: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    color: '#0F0F0F',
    textAlign: 'center',
  },
});


