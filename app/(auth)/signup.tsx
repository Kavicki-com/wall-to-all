import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { CustomInput } from '../../components/ui/CustomInput';
import ScreenContainer from '../../components/layout/ScreenContainer';
import { CustomButton } from '../../components/CustomButton';
import { validateEmail } from '../../lib/validations';

const SignupScreen: React.FC = () => {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('SignupScreen mounted');
  }, []);

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      setEmail('');
      setPassword('');
      setConfirm('');
      setError(null);
    }, [])
  );

  const handleSignup = async () => {
    setError(null);

    if (!email || !password || !confirm) {
      setError('Preencha todos os campos.');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }

    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    try {
      setLoading(true);

      const { error: signUpError } = await supabase.auth.signUp(
        {
          email,
          password,
        },
      );

      if (signUpError) {
        console.log('Erro signup supabase', signUpError);
        setError(signUpError.message);
        return;
      }

      router.replace('/(auth)/user-type-selection');
    } catch (e) {
      console.log('Erro inesperado signup', e);
      setError('Ocorreu um erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer scroll backgroundColor="#020617">
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Cadastro</Text>
        <Text style={styles.subtitle}>Crie sua conta Wall to All</Text>

        <View style={styles.form}>
          <CustomInput
            placeholder="E-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            containerStyle={styles.inputGroup}
          />

          <CustomInput
            placeholder="Senha"
            isPassword
            value={password}
            onChangeText={setPassword}
            containerStyle={styles.inputGroup}
          />

          <CustomInput
            placeholder="Confirmar senha"
            isPassword
            value={confirm}
            onChangeText={setConfirm}
            containerStyle={styles.inputGroup}
            error={error || undefined}
          />

          <CustomButton
            title="Registrar"
            onPress={handleSignup}
            isLoading={loading}
            disabled={loading}
            variant="red"
            style={{ borderRadius: 24, marginTop: 8 }}
          />

          <CustomButton
            title="Já tem conta? Fazer login"
            variant="ghost"
            onPress={handleGoToLogin}
            style={{ marginTop: 12, marginVertical: 0 }}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e5e7eb',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
  },
  form: {
    gap: 12,
  },
  inputGroup: {
    marginBottom: 0,
  },
});

