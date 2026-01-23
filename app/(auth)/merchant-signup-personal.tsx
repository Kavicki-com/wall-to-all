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
import SignupHeaderMerchant from '../../components/auth/SignupHeaderMerchant';
import { CustomButton } from '../../components/CustomButton';
import { validateEmail, validatePassword } from '../../lib/validations';
import { useSafeGoBack } from '../../lib/router-utils';
import { logger } from '../../lib/logger';
import { suggestEmailCorrection } from '../../lib/emailUtils';

const MerchantSignupPersonalScreen: React.FC = () => {
  const router = useRouter();
  const { showError } = useToast();
  const safeGoBack = useSafeGoBack('/(auth)/user-type-selection');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOAuth, setIsOAuth] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  // New referral states
  const [referralCode, setReferralCode] = useState('');
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralSuccess, setReferralSuccess] = useState<string | null>(null);

  // Field errors
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    confirmEmail?: string;
    password?: string;
    confirmPassword?: string;
    referralCode?: string;
  }>({});

  const validateForm = () => {
    const isNameValid = fullName.trim().length >= 3 && /^[a-zA-ZÀ-ÿ\s'-]+$/.test(fullName);
    const isEmailValid = validateEmail(email.trim());
    const isEmailConfirmed = email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();

    if (isOAuth) {
      return isNameValid && isEmailValid && isEmailConfirmed;
    }

    const passResult = validatePassword(password);
    const isPasswordConfirmed = password === confirmPassword;
    return isNameValid && isEmailValid && isEmailConfirmed && passResult.isValid && isPasswordConfirmed;
  };

  const handleNameChange = (text: string) => {
    // Proibir números em tempo real
    const filtered = text.replace(/[0-9]/g, '');
    setFullName(filtered);

    if (filtered.trim().length > 0 && filtered.trim().length < 3) {
      setErrors(prev => ({ ...prev, fullName: 'Nome muito curto' }));
    } else if (filtered.length > 0 && !/^[a-zA-ZÀ-ÿ\s'-]+$/.test(filtered)) {
      setErrors(prev => ({ ...prev, fullName: 'Nome contém caracteres inválidos' }));
    } else {
      setErrors(prev => ({ ...prev, fullName: undefined }));
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailSuggestion(null); // Clear suggestion as user types

    if (text.length > 0 && !validateEmail(text.trim())) {
      setErrors(prev => ({ ...prev, email: 'Email inválido' }));
    } else {
      setErrors(prev => ({ ...prev, email: undefined }));
    }

    // Check confirmation if it's already filled
    if (confirmEmail.length > 0) {
      if (text.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
        setErrors(prev => ({ ...prev, confirmEmail: 'Os emails não coincidem' }));
      } else {
        setErrors(prev => ({ ...prev, confirmEmail: undefined }));
      }
    }
  };

  const handleEmailBlur = () => {
    if (isOAuth) return;

    const sanitized = email.trim().toLowerCase();
    setEmail(sanitized);

    // After sanitization, check for typos
    if (validateEmail(sanitized)) {
      const suggestion = suggestEmailCorrection(sanitized);
      setEmailSuggestion(suggestion);
    }
  };

  const applySuggestion = () => {
    if (emailSuggestion) {
      setEmail(emailSuggestion);
      setEmailSuggestion(null);
      setErrors(prev => ({ ...prev, email: undefined }));

      // Also update confirm if already matched before
      if (confirmEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
        setConfirmEmail(emailSuggestion);
        setErrors(prev => ({ ...prev, confirmEmail: undefined }));
      }
    }
  };

  const handleConfirmEmailChange = (text: string) => {
    setConfirmEmail(text);
    if (text.length > 0 && text.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setErrors(prev => ({ ...prev, confirmEmail: 'Os emails não coincidem' }));
    } else {
      setErrors(prev => ({ ...prev, confirmEmail: undefined }));
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (text.length > 0) {
      const result = validatePassword(text);
      if (!result.isValid) {
        setErrors(prev => ({ ...prev, password: result.errors[0] }));
      } else {
        setErrors(prev => ({ ...prev, password: undefined }));
      }
    } else {
      setErrors(prev => ({ ...prev, password: undefined }));
    }

    // Check confirmation if already filled
    if (confirmPassword.length > 0) {
      if (text !== confirmPassword) {
        setErrors(prev => ({ ...prev, confirmPassword: 'As senhas não coincidem' }));
      } else {
        setErrors(prev => ({ ...prev, confirmPassword: undefined }));
      }
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (text.length > 0 && text !== password) {
      setErrors(prev => ({ ...prev, confirmPassword: 'As senhas não coincidem' }));
    } else {
      setErrors(prev => ({ ...prev, confirmPassword: undefined }));
    }
  };

  const handleReferralChange = (text: string) => {
    // Remove espaços e converte para maiúsculo
    const formatted = text.trim().toUpperCase();
    setReferralCode(formatted);
    setReferralError(null);
    setReferralSuccess(null);
    setErrors(prev => ({ ...prev, referralCode: undefined }));
  };

  const handleReferralBlur = async () => {
    if (!referralCode) return;

    // Se tiver menos de 8 chars, nem valida no banco
    if (referralCode.length < 8) {
      setReferralError('Código inválido (muito curto)');
      return;
    }

    try {
      setIsValidatingReferral(true);

      // Import dinâmico para evitar dependência cíclica
      const { supabase } = await import('../../lib/supabase');

      const { data, error } = await supabase
        .from('referral_codes')
        .select('id')
        .eq('code', referralCode)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setReferralSuccess('Código válido!');
        setReferralError(null);
      } else {
        setReferralError('Código não encontrado');
        setReferralSuccess(null);
      }
    } catch (err) {
      logger.warn('[MerchantSignup] Erro ao validar código de referral:', err);
      // Não bloqueia o usuário em caso de erro de rede
      setReferralError('Não foi possível validar o código');
    } finally {
      setIsValidatingReferral(false);
    }
  };
  // Verificar se é OAuth e pré-preencher dados
  useEffect(() => {
    const checkOAuthAndPrefill = async () => {
      try {
        // 1. Verificar draft primeiro
        const draftKey = 'merchant_signup_draft';
        const storedDraft = await AsyncStorage.getItem(draftKey);

        if (storedDraft) {
          const parsed = JSON.parse(storedDraft);
          setFullName(parsed.full_name || '');
          setEmail(parsed.email || '');
          setConfirmEmail(parsed.email || '');
          setIsOAuth(!!parsed.is_oauth);
          if (parsed.referral_code) {
            setReferralCode(parsed.referral_code);
          }
          return;
        }

        // 2. Verificar OAuth
        const oauthFlag = await AsyncStorage.getItem('oauth_google_signup');
        const oauthDataStr = await AsyncStorage.getItem('oauth_google_data');

        if (oauthFlag === 'true' && oauthDataStr) {
          const oauthData = JSON.parse(oauthDataStr);

          // Pré-preencher campos com dados do Google
          setFullName(oauthData.full_name || '');
          setEmail(oauthData.email || '');
          setConfirmEmail(oauthData.email || '');
          setIsOAuth(true);

          // Clear errors for pre-filled fields
          setErrors(prev => ({
            ...prev,
            fullName: undefined,
            email: undefined,
            confirmEmail: undefined,
          }));

          if (__DEV__) {
            logger.debug('[MerchantSignupPersonal] OAuth detectado, campos pré-preenchidos');
          }
        }

        // 3. Verificar código de referral salvo via deep link
        const savedReferralCode = await AsyncStorage.getItem('referral_code');
        if (savedReferralCode) {
          setReferralCode(savedReferralCode);
        }
      } catch (error) {
        if (__DEV__) {
          logger.error('[MerchantSignupPersonal] Erro ao verificar OAuth:', error);
        }
      }
    };

    checkOAuthAndPrefill();
  }, []);

  // Effect para validar o código vindo do deep link automaticamente após carregamento
  useEffect(() => {
    if (referralCode && !referralSuccess && !referralError && !isValidatingReferral) {
      // Pequeno delay para garantir que a renderização inicial ocorreu
      const timer = setTimeout(() => {
        handleReferralBlur();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [referralCode]);

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  // Mas NÃO resetar se for OAuth, pois os dados foram preenchidos pelo useEffect
  useFocusEffect(
    React.useCallback(() => {
      setPassword('');
      setConfirmPassword('');
      setError(null);
    }, [])
  );

  const handleContinue = async () => {
    const isValid = validateForm();
    if (!isValid) {
      setError('Por favor, corrija os erros no formulário.');
      return;
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
      const draftKey = 'merchant_signup_draft';
      const draftData = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: isOAuth ? undefined : password,
        user_type: 'merchant',
        signup_started_at: new Date().toISOString(),
        is_oauth: isOAuth,
        oauth_provider: isOAuth ? 'google' : undefined,
        avatar_url: avatarUrl,
        referral_code: referralCode ? referralCode : undefined,
      };

      await AsyncStorage.setItem(draftKey, JSON.stringify(draftData));

      // Se temos um referral code válido e validado, podemos salvar no AsyncStorage global também
      if (referralCode && referralSuccess) {
        await AsyncStorage.setItem('referral_code', referralCode);
      }

      router.push({
        pathname: '/(auth)/merchant-signup-address',
      });
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
        <SignupHeaderMerchant
          title="Dados pessoais"
          subtitle="Vamos começar o seu cadastro"
          steps={['Cadastro', 'Endereço', 'Negócio', 'Serviços']}
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
          onChangeText={handleNameChange}
          error={errors.fullName}
        />

        <CustomInput
          label="Email"
          placeholder="seu@email.com"
          value={email}
          onChangeText={handleEmailChange}
          onBlur={handleEmailBlur}
          keyboardType="email-address"
          autoCapitalize="none"
          disabled={isOAuth}
          error={errors.email}
        />

        {emailSuggestion && (
          <View style={styles.suggestionContainer}>
            <Text style={styles.suggestionText}>
              Você quis dizer{' '}
              <Text
                style={styles.suggestionLink}
                onPress={applySuggestion}
              >
                {emailSuggestion}
              </Text>?
            </Text>
          </View>
        )}

        <CustomInput
          label="Confirme seu email"
          placeholder="seu@email.com"
          value={confirmEmail}
          onChangeText={handleConfirmEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          disabled={isOAuth}
          error={errors.confirmEmail}
        />

        {/* Campos de senha apenas para cadastro por email */}
        {!isOAuth && (
          <>
            <CustomInput
              label="Senha"
              placeholder="***********"
              isPassword
              value={password}
              onChangeText={handlePasswordChange}
              helperText="Utilize letras, números e um caractere especial"
              error={errors.password}
            />

            <CustomInput
              label="Confirmar Senha"
              placeholder="***********"
              isPassword
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              helperText="As senhas devem ser iguais"
              error={errors.confirmPassword}
            />
          </>
        )}

        <View>
          <CustomInput
            label="Código de indicação (Opcional)"
            placeholder="Ex: SEUCODIGO"
            value={referralCode}
            onChangeText={handleReferralChange}
            onBlur={handleReferralBlur}
            autoCapitalize="characters"
            maxLength={12}
            error={referralError || undefined}
            helperText={referralSuccess || undefined}
            editable={!isValidatingReferral}
          />
          {isValidatingReferral && (
            <Text style={{ fontSize: 12, color: '#666', marginTop: -8, marginLeft: 4 }}>Validando...</Text>
          )}
          {referralSuccess && (
            <Text style={{ fontSize: 12, color: '#28A745', marginTop: -8, marginLeft: 4 }}>✓ {referralSuccess}</Text>
          )}
        </View>

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
          disabled={loading || !validateForm()}
          variant="primary"
          style={{ borderRadius: 24, marginVertical: 0, marginTop: 24 }}
          width="100%"
          accessibilityState={{ disabled: loading, busy: loading }}
        />
      </View>
    </ScreenContainer>
  );
};

export default MerchantSignupPersonalScreen;

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
  suggestionContainer: {
    marginTop: -8,
    paddingLeft: 4,
  },
  suggestionText: {
    color: '#666',
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
  },
  suggestionLink: {
    color: '#4A90E2',
    textDecorationLine: 'underline',
    fontFamily: 'Montserrat_600SemiBold',
  },
});