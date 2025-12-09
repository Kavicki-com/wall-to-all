import React, { useMemo, useState } from 'react';
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
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { responsiveHeight } from '../../lib/responsive';

const ClientSignupPersonalScreen: React.FC = () => {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

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

    if (!emailRegex.test(trimmedEmail)) {
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
        if (signUpError.message.includes('User already registered')) {
          setError('Já existe uma conta com este e-mail.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (!data?.user) {
        setError('Não foi possível criar o usuário.');
        return;
      }

      const { data: sessionCheck } = await supabase.auth.getSession();
      if (!sessionCheck?.session) {
        setError('Conta criada. Confirme o e-mail e faça login para prosseguir.');
        return;
      }

      router.push('/(auth)/client-signup-address');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro inesperado ao criar conta.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.background}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerBackground}>
            {/* Fundo Sólido - Base Dark Navy */}
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: '#000E3D' },
              ]}
            />

            {/* Svg Radial Gradient - Efeito Difuso */}
            <Svg style={StyleSheet.absoluteFillObject} viewBox="0 0 390 129" preserveAspectRatio="none">
              <Defs>
                <SvgRadialGradient
                  id="headerRadialGradient"
                  cx="0.5"
                  cy="0.3" 
                  rx="100%" 
                  ry="100%" 
                  gradientUnits="objectBoundingBox"
                >
                  {/* CORREÇÃO AQUI: 
                    1. rx="100%" estica a luz horizontalmente para não formar uma "bola".
                    2. cy="0.3" sobe um pouco a luz para vir de cima.
                    3. Cor central muito mais escura e desaturada (rgba 50, 70, 140).
                       Antes estava muito neon (74, 108, 255), o que causava o brilho excessivo.
                  */}
                  <Stop offset="0%" stopColor="rgba(50, 70, 140, 0.3)" />
                  
                  {/* As pontas fundem perfeitamente com o background */}
                  <Stop offset="100%" stopColor="#000E3D" stopOpacity="1" />
                </SvgRadialGradient>
              </Defs>
              <Rect x="0" y="0" width="390" height="129" fill="url(#headerRadialGradient)" />
            </Svg>
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.welcomeTitle}>Dados pessoais</Text>
            <Text style={styles.welcomeSubtitle}>
              Vamos começar o seu cadastro
            </Text>
          </View>
        </View>

        {/* Step bar - fluxo de cliente tem 2 passos: Cadastro + Endereço */}
        <View style={styles.stepBar}>
          <View style={[styles.stepSegment, styles.stepSegmentActive]} />
          <View style={styles.stepSegment} />
        </View>
        <View style={styles.stepLabels}>
          <Text style={styles.stepLabelActive}>Cadastro</Text>
          <Text style={styles.stepLabel}>Endereço</Text>
        </View>

        {/* Formulário */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Seu nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Seu Nome aqui"
              placeholderTextColor="#0f0f0f"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor="#0f0f0f"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirme seu email</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor="#0f0f0f"
              value={confirmEmail}
              onChangeText={setConfirmEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="***********"
              placeholderTextColor="#0f0f0f"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Text style={styles.helperText}>
              Utilize letras, números e um caractere especial
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="***********"
              placeholderTextColor="#0f0f0f"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <Text style={styles.helperText}>As senhas devem ser iguais</Text>
          </View>
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {/* Botão Continuar */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.buttonContained, loading && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleContinue}
            disabled={loading}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#FEFEFE" />
            ) : (
              <Text style={styles.buttonContainedText}>Continuar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ClientSignupPersonalScreen;

// Calcular altura responsiva do header ANTES do StyleSheet.create
const headerHeight = responsiveHeight(129);

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 32,
  },
  header: {
    height: headerHeight,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: -24,
  },
  headerBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  headerContent: {
    width: '90%',
    maxWidth: 342,
    height: 49,
    gap: 4,
    alignItems: 'flex-start',
    zIndex: 1,
    alignSelf: 'center',
  },
  welcomeTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: '#FEFEFE',
  },
  welcomeSubtitle: {
    marginTop: 4,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#FEFEFE',
  },
  stepBar: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 24,
    width: '90%',
    maxWidth: 342,
    alignSelf: 'center',
  },
  stepSegment: {
    flex: 1,
    height: 8,
    borderRadius: 24,
    backgroundColor: '#DBDBDB',
  },
  stepSegmentActive: {
    backgroundColor: '#E5102E',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    maxWidth: 342,
    alignSelf: 'center',
    marginTop: 4,
  },
  stepLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: '#0F0F0F',
    textAlign: 'center',
    flex: 1,
  },
  stepLabelActive: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: '#0F0F0F',
    textAlign: 'center',
    flex: 1,
  },
  form: {
    marginTop: 24,
    width: '90%',
    maxWidth: 342,
    alignSelf: 'center',
    gap: 16,
  },
  inputGroup: {
    width: '100%',
  },
  label: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: '#000E3D',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  helperText: {
    marginTop: 4,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: '#0F0F0F',
  },
  errorText: {
    marginTop: 12,
    alignSelf: 'center',
    color: '#E5102E',
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
  },
  actions: {
    marginTop: 'auto',
    width: '90%',
    maxWidth: 342,
    alignSelf: 'center',
  },
  buttonContained: {
    width: '100%',
    backgroundColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContainedText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: '#FEFEFE',
  },
});


