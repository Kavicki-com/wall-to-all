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

const MerchantSignupPersonalScreen: React.FC = () => {
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
            user_type: 'merchant',
            avatar_url: null,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          setError('Já existe uma conta com este e-mail.');
          setLoading(false);
          return;
        } else if (signUpError.message.includes('Database error')) {
          // Erro no trigger, mas vamos tentar continuar se o usuário foi criado
          // Não mostrar o erro no console para não aparecer na tela
          
          // Verificar se o usuário foi criado mesmo assim
          if (data?.user) {
            // Usuário foi criado, vamos criar o perfil manualmente
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: data?.user?.id,
                full_name: fullName,
                user_type: 'merchant',
                avatar_url: null,
              });

            if (profileError) {
              setError('Conta criada, mas houve erro ao criar perfil. Tente fazer login.');
              setLoading(false);
              return;
            }

            // Perfil criado com sucesso, continuar o fluxo normalmente
            // (não retornar, deixar continuar para o resto do código)
          } else {
            // Tentar fazer login para verificar se o usuário foi criado
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (signInError || !signInData?.user) {
              setError('Erro ao criar conta. O trigger de perfil pode estar com problema. Tente novamente.');
              setLoading(false);
              return;
            }

            // Usuário existe, criar perfil manualmente
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: signInData?.user?.id,
                full_name: fullName,
                user_type: 'merchant',
                avatar_url: null,
              });

            if (profileError) {
              setError('Conta criada, mas houve erro ao criar perfil. Tente fazer login.');
              setLoading(false);
              return;
            }

            // Usar o usuário do login
            const user = signInData?.user;
            const session = signInData?.session || null;
            
            // Continuar o fluxo com o usuário logado
            router.push({
              pathname: '/(auth)/merchant-signup-address',
              params: { userId: user.id },
            });
            setLoading(false);
            return;
          }
        } else {
          setError(signUpError.message);
          setLoading(false);
          return;
        }
      }

      const user = data?.user;
      if (!user) {
        setError('Não foi possível criar o usuário.');
        setLoading(false);
        return;
      }

      // Verificar se há sessão do signUp ou fazer login automático
      let session = data?.session || null;

      // Se não houver sessão do signUp, tentar fazer login automático
      if (!session || !session.user) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          console.error('Erro ao fazer login automático:', signInError);
          setError('Erro ao fazer login. Tente fazer login manualmente.');
          setLoading(false);
          return;
        }

        if (signInData?.session) {
          session = signInData?.session;
        }
        
        // Aguardar um pouco para garantir que a sessão foi estabelecida
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Verificar se o perfil foi criado pelo trigger, se não, criar manualmente
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileCheckError || !existingProfile) {
        // Perfil não existe, criar manualmente
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: fullName,
            user_type: 'merchant',
            avatar_url: null,
          });

        if (profileError) {
          console.error('Erro ao criar perfil:', profileError);
          // Não bloquear o fluxo, apenas logar o erro
          // O trigger pode ter criado o perfil mas com dados diferentes
        }
      }

      // business_profiles será criado na tela de negócio
      // (não criar aqui porque business_name é obrigatório)

      // 2) Avança para o passo de endereço levando o userId
      router.push({
        pathname: '/(auth)/merchant-signup-address',
        params: { userId: user.id },
      });
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

        {/* Step bar - fluxo de lojista tem 4 passos */}
        <View style={styles.stepBar}>
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
            <View style={styles.stepSegment} />
            <View style={styles.stepSegment} />
            <View style={styles.stepSegment} />
        </View>
          <View style={styles.stepLabels}>
            <Text style={styles.stepLabelActive}>Cadastro</Text>
            <Text style={styles.stepLabel}>Endereço</Text>
            <Text style={styles.stepLabel}>Negócio</Text>
            <Text style={styles.stepLabel}>Serviços</Text>
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
              <Text style={styles.helperText}>
                As senhas devem ser iguais
              </Text>
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

export default MerchantSignupPersonalScreen;

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


