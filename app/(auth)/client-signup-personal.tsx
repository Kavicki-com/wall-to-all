import React, { useState } from 'react';
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
import { RadialGradient, LinearGradient } from 'react-native-gradients';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

const ClientSignupPersonalScreen: React.FC = () => {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!fullName || !email || !password) {
      setError('Preencha nome, e-mail e senha.');
      return;
    }

    if (email !== confirmEmail) {
      setError('Os e-mails não coincidem.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1) Cria usuário no Supabase Auth com metadados para a trigger de profiles
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'walltoall://auth/login',
          data: {
            full_name: fullName,
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

      const user = data?.user;
      if (!user) {
        setError('Não foi possível criar o usuário.');
        return;
      }

      // 2) Vai para tela de endereço
      router.push('/(auth)/client-signup-address');
    } catch (e: any) {
      setError(e?.message ?? 'Erro inesperado ao criar conta.');
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
        {/* Header com o mesmo gradiente da tela de seleção de tipo */}
        <View style={styles.header}>
          <View style={styles.headerBackground}>
            {/* base: surface/primary (#000E3D) */}
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: '#000E3D' },
              ]}
            />
            {/* linear escuro */}
            <LinearGradient
              style={StyleSheet.absoluteFillObject}
              angle={0}
              colorList={[
                { offset: '0%', color: 'rgba(0, 14, 61, 0.80)', opacity: '1' },
                { offset: '100%', color: 'rgba(0, 14, 61, 0.95)', opacity: '1' },
              ]}
            />
            {/* radial suave ocupando a faixa inteira */}
            <RadialGradient
              style={StyleSheet.absoluteFillObject}
              x={0.5}
              y={0.55}
              rx={2.0}
              ry={1.0}
              colorList={[
                {
                  offset: '0%',
                  color: 'rgba(214, 224, 255, 0.18)',
                  opacity: '1',
                },
                {
                  offset: '100%',
                  color: 'rgba(0, 14, 61, 0.0)',
                  opacity: '1',
                },
              ]}
            />
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
            style={styles.buttonContained}
            activeOpacity={0.8}
            onPress={handleContinue}
            disabled={loading}
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
    height: 129,
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
    width: 342,
    height: 49,
    gap: 4,
    alignItems: 'flex-start',
    zIndex: 1,
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
    width: 342,
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
    width: 342,
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
    width: 342,
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
    width: 342,
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


