import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { CustomInput } from '../../components/ui/CustomInput';
import { useToast } from '../../components/ui/ToastProvider';
import { handleError } from '../../lib/errorHandler';
import ScreenContainer from '../../components/layout/ScreenContainer';
import SignupHeaderClient from '../../components/auth/SignupHeaderClient';
import { CustomButton } from '../../components/CustomButton';
import { validateEmail } from '../../lib/validations';
import { safeGoBack } from '../../lib/router-utils';

const ClientSignupPersonalScreen: React.FC = () => {
  const router = useRouter();
  const { showError } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      setFullName('');
      setEmail('');
      setConfirmEmail('');
      setPassword('');
      setConfirmPassword('');
      setError(null);
    }, [])
  );

  const isStrongPassword = (value: string) => {
    if (!value || value.length < 8) return false;
    const hasNumber = /\d/.test(value);
    const hasLetter = /[A-Za-z]/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);
    return hasNumber && hasLetter && hasSpecial;
  };

  const handleContinue = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedConfirmEmail = confirmEmail.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      setError('Preencha nome, e-mail e senha.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Informe um e-mail válido.');
      return;
    }

    if (trimmedEmail !== trimmedConfirmEmail) {
      setError('Os e-mails não coincidem.');
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!isStrongPassword(trimmedPassword)) {
      setError('Use senha com 8+ caracteres, letras, números e símbolo.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          emailRedirectTo: 'walltoall://auth/login',
          data: {
            full_name: trimmedName,
            user_type: 'client',
            avatar_url: null,
          },
        },
      });

      if (signUpError) {
        const processed = handleError(signUpError, 'signup');
        setError(processed.userMessage);
        showError(processed.userMessage);
        return;
      }

      if (!data?.user) {
        const message = 'Não foi possível criar o usuário.';
        setError(message);
        showError(message);
        return;
      }

      const { data: sessionCheck } = await supabase.auth.getSession();
      if (!sessionCheck?.session) {
        const message = 'Conta criada. Confirme o e-mail e faça login para prosseguir.';
        setError(message);
        showError(message);
        return;
      }

      router.push('/(auth)/client-signup-address');
    } catch (e) {
      const processed = handleError(e, 'signup');
      setError(processed.userMessage);
      showError(processed.userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      scroll
      backgroundColor="#FEFEFE"
      contentContainerStyle={{ flexGrow: 1, paddingTop: 0, paddingBottom: 16 }}
      header={
        <SignupHeaderClient
          title="Dados pessoais"
          subtitle="Vamos começar o seu cadastro"
          steps={['Cadastro', 'Endereço']}
          currentStepIndex={0}
          showBackButton={true}
          onPressBack={() => safeGoBack('/(auth)/user-type-selection')}
        />
      }
    >

      {/* Formulário */}
      <View style={styles.form}>
        <CustomInput
          label="Seu nome"
          placeholder="Seu Nome aqui"
          value={fullName}
          onChangeText={setFullName}
        />

        <CustomInput
          label="Email"
          placeholder="seu@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <CustomInput
          label="Confirme seu email"
          placeholder="seu@email.com"
          value={confirmEmail}
          onChangeText={setConfirmEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <CustomInput
          label="Senha"
          placeholder="***********"
          isPassword
          value={password}
          onChangeText={setPassword}
          helperText="Utilize letras, números e um caractere especial"
        />

        <CustomInput
          label="Confirmar Senha"
          placeholder="***********"
          isPassword
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          helperText="As senhas devem ser iguais"
        />

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <CustomButton
          title="Continuar"
          onPress={handleContinue}
          isLoading={loading}
          disabled={loading}
          variant="primary"
          style={{ borderRadius: 24, marginVertical: 0, marginTop: 24 }}
          width="100%"
          accessibilityState={{ disabled: loading, busy: loading }}
        />
      </View>
    </ScreenContainer>
  );
};

export default ClientSignupPersonalScreen;

const styles = StyleSheet.create({
  form: {
    marginTop: 24,
    width: '100%',
    gap: 16,
  },
  errorText: {
    marginTop: 12,
    alignSelf: 'center',
    color: '#E5102E',
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
  },
});


