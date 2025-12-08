import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

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

  const handleSignup = async () => {
    setError(null);

    if (!email || !password || !confirm) {
      setError('Preencha todos os campos.');
      return;
    }

    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    try {
      setLoading(true);

      const { data, error: signUpError } = await supabase.auth.signUp(
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
    router.back();
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Cadastro</Text>
        <Text style={styles.subtitle}>Crie sua conta Wall to All</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor="#6b7280"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TextInput
            style={styles.input}
            placeholder="Confirmar senha"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Registrar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkWrapper}
            onPress={handleGoToLogin}
          >
            <Text style={styles.linkText}>Já tem conta? Fazer login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
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
  input: {
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#e5e7eb',
    fontSize: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#e5102e',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '700',
  },
  linkWrapper: {
    marginTop: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

