import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomInput } from '../../components/ui/CustomInput';
import { useToast } from '../../components/ui/ToastProvider';
import { handleError } from '../../lib/errorHandler';
import ScreenContainer from '../../components/layout/ScreenContainer';
import SignupHeaderClient from '../../components/auth/SignupHeaderClient';
import { CustomButton } from '../../components/CustomButton';
import { validateEmail } from '../../lib/validations';
import { useSafeGoBack } from '../../lib/router-utils';
import { logger } from '../../lib/logger';

const ClientSignupPersonalScreen: React.FC = () => {
  const router = useRouter();
  const { showError } = useToast();
  const safeGoBack = useSafeGoBack('/(auth)/login');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOAuth, setIsOAuth] = useState(false);

  // Verificar se é OAuth e pré-preencher dados
  useEffect(() => {
    const checkOAuthAndPrefill = async () => {
      try {
        const oauthFlag = await AsyncStorage.getItem('oauth_google_signup');
        const oauthDataStr = await AsyncStorage.getItem('oauth_google_data');
        
        if (oauthFlag === 'true' && oauthDataStr) {
          const oauthData = JSON.parse(oauthDataStr);
          
          // Pré-preencher campos com dados do Google
          setFullName(oauthData.full_name || '');
          setEmail(oauthData.email || '');
          setConfirmEmail(oauthData.email || '');
          setIsOAuth(true);
          
          if (__DEV__) {
            logger.debug('[ClientSignupPersonal] OAuth detectado, campos pré-preenchidos');
          }
        }
      } catch (error) {
        if (__DEV__) {
          logger.error('[ClientSignupPersonal] Erro ao verificar OAuth:', error);
        }
      }
    };
    
    checkOAuthAndPrefill();
  }, []);

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

    if (!trimmedName || trimmedName.length < 3) {
      setError('Nome deve ter pelo menos 3 caracteres.');
      return;
    }

    if (!/[a-zA-ZÀ-ÿ]/.test(trimmedName)) {
      setError('Nome deve conter pelo menos uma letra.');
      return;
    }

    if (!trimmedEmail) {
      setError('Preencha o e-mail.');
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

    // Validações de senha apenas se NÃO for OAuth
    if (!isOAuth) {
      const trimmedPassword = password.trim();
      const trimmedConfirmPassword = confirmPassword.trim();

      if (!trimmedPassword) {
        setError('Preencha a senha.');
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
    }

    try {
      setLoading(true);
      setError(null);

      // Buscar dados OAuth se existirem
      let avatarUrl = null;
      if (isOAuth) {
        const oauthDataStr = await AsyncStorage.getItem('oauth_google_data');
        if (oauthDataStr) {
          const oauthData = JSON.parse(oauthDataStr);
          avatarUrl = oauthData.avatar_url;
        }
      }

      // Salvar dados pessoais no AsyncStorage ao invés de criar usuário
      // O usuário só será criado na tela de loading após completar todo o fluxo
      const draftKey = 'client_signup_draft';
      const draftData = {
        full_name: trimmedName,
        email: trimmedEmail,
        password: isOAuth ? undefined : password.trim(),
        user_type: 'client',
        signup_started_at: new Date().toISOString(),
        is_oauth: isOAuth,
        oauth_provider: isOAuth ? 'google' : undefined,
        avatar_url: avatarUrl,
      };

      await AsyncStorage.setItem(draftKey, JSON.stringify(draftData));

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
          onPressBack={safeGoBack}
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
          editable={!isOAuth}
        />

        <CustomInput
          label="Confirme seu email"
          placeholder="seu@email.com"
          value={confirmEmail}
          onChangeText={setConfirmEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isOAuth}
        />

        {/* Campos de senha apenas para cadastro por email */}
        {!isOAuth && (
          <>
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
          </>
        )}

        {/* Mensagem informativa para OAuth */}
        {isOAuth && (
          <Text style={styles.oauthInfo}>
            Dados vindos da sua conta Google. Você pode editar o nome se desejar.
          </Text>
        )}

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
  oauthInfo: {
    marginTop: 8,
    color: '#4A90E2',
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});


