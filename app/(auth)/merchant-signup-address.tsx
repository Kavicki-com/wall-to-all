import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { responsiveHeight } from '../../lib/responsive';

const MerchantSignupAddressScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [complemento, setComplemento] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  const formatCEP = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 5) {
      return cleaned;
    }
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
  };

  const handleCEPChange = async (text: string) => {
    const formatted = formatCEP(text);
    setCep(formatted);

    // Se CEP completo, buscar endereço
    if (formatted.length === 9) {
      await fetchAddressByCEP(formatted.replace('-', ''));
    }
  };

  const fetchAddressByCEP = async (cepValue: string) => {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepValue}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setEndereco(data.logradouro || '');
        setBairro(data.bairro || '');
        setCidade(data.localidade || '');
        setEstado(data.uf || '');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  const draftKey = 'merchant_address_draft';

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const stored = await AsyncStorage.getItem(draftKey);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        setCep(parsed.cep || '');
        setEndereco(parsed.endereco || '');
        setComplemento(parsed.complemento || '');
        setNumero(parsed.numero || '');
        setBairro(parsed.bairro || '');
        setCidade(parsed.cidade || '');
        setEstado(parsed.estado || '');
      } catch {
        // ignore draft errors
      }
    };
    loadDraft();
  }, []);

  const persistDraft = async () => {
    const payload = { cep, endereco, complemento, numero, bairro, cidade, estado };
    try {
      await AsyncStorage.setItem(draftKey, JSON.stringify(payload));
    } catch {
      // ignore persistence errors
    }
  };

  const handleContinue = async () => {
    const requiredFilled = cep && endereco && numero && bairro && cidade && estado;
    if (!requiredFilled || cep.length < 9) {
      setError('Preencha todos os campos obrigatórios com CEP válido.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Usuário não autenticado.');
        return;
      }

      const addressData = {
        address: `${endereco}, ${numero}${complemento ? ` - ${complemento}` : ''}, ${bairro}, ${cidade} - ${estado}, CEP: ${cep}`,
        cep,
        cidade,
        estado,
      };

      await persistDraft();

      router.push({
        pathname: '/(auth)/merchant-signup-business',
        params: { 
          userId: user.id,
          addressData: JSON.stringify(addressData),
        },
      });
    } catch (err: any) {
      console.error('Erro ao salvar endereço:', err);
      setError(err.message || 'Erro ao salvar endereço.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header com gradiente do Figma */}
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
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 129" preserveAspectRatio="none">
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
            <Text style={styles.title}>Dados de endereço</Text>
            <Text style={styles.subtitle}>Adicione seu endereço</Text>
          </View>
        </View>

        {/* Progress bars com labels */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStep}>
            <View style={[styles.progressBar, styles.progressBarComplete]} />
            <Text style={styles.progressLabel}>Cadastro</Text>
          </View>
          <View style={styles.progressStep}>
            <View style={[styles.progressBar, styles.progressBarComplete]} />
            <Text style={styles.progressLabel}>Endereço</Text>
          </View>
          <View style={styles.progressStep}>
            <View style={[styles.progressBar, styles.progressBarInactive]} />
            <Text style={styles.progressLabel}>Negócio</Text>
          </View>
          <View style={styles.progressStep}>
            <View style={[styles.progressBar, styles.progressBarInactive]} />
            <Text style={styles.progressLabel}>Serviços</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* CEP */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>CEP</Text>
            <TextInput
              style={styles.input}
              placeholder="00000-000"
              placeholderTextColor="#999"
              value={cep}
              onChangeText={handleCEPChange}
              keyboardType="numeric"
              maxLength={9}
            />
          </View>

          {/* Endereço */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Endereço</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite sua rua aqui"
              placeholderTextColor="#999"
              value={endereco}
              onChangeText={setEndereco}
            />
          </View>

          {/* Complemento */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Complemento</Text>
            <TextInput
              style={styles.input}
              placeholder="Selecione aqui"
              placeholderTextColor="#999"
              value={complemento}
              onChangeText={setComplemento}
            />
          </View>

          {/* Número e Bairro */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.inputNumero]}>
              <Text style={styles.label}>Número</Text>
              <TextInput
                style={styles.input}
                placeholder="número"
                placeholderTextColor="#999"
                value={numero}
                onChangeText={setNumero}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, styles.inputBairro]}>
              <Text style={styles.label}>Bairro</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu bairro"
                placeholderTextColor="#999"
                value={bairro}
                onChangeText={setBairro}
              />
            </View>
          </View>

          {/* Cidade e Estado */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.inputCidade]}>
              <Text style={styles.label}>Cidade</Text>
              <TextInput
                style={styles.input}
                placeholder=""
                placeholderTextColor="#999"
                value={cidade}
                onChangeText={setCidade}
              />
            </View>
            <View style={[styles.inputGroup, styles.inputEstado]}>
              <Text style={styles.label}>Estado</Text>
              <TextInput
                style={styles.input}
                placeholder="UF"
                placeholderTextColor="#999"
                value={estado}
                onChangeText={(text) => setEstado(text.toUpperCase())}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, loading && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FEFEFE" />
            ) : (
              <Text style={styles.continueButtonText}>Continuar</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default MerchantSignupAddressScreen;

// Calcular altura responsiva do header ANTES do StyleSheet.create
const headerHeight = responsiveHeight(129);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingBottom: 24,
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
    marginBottom: 24,
  },
  headerBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  headerContent: {
    width: '90%',
    maxWidth: 342,
    gap: 4,
    alignItems: 'flex-start',
    zIndex: 1,
    paddingBottom: 24,
    backgroundColor: '#000E3D',
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#FEFEFE',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  progressStep: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 24,
  },
  progressBarComplete: {
    backgroundColor: '#E5102E',
  },
  progressBarInactive: {
    backgroundColor: '#DBDBDB',
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    textAlign: 'center',
  },
  form: {
    gap: 16,
    paddingHorizontal: 24,
  },
  inputGroup: {
    gap: 4,
  },
  inputNumero: {
    width: 97,
  },
  inputBairro: {
    flex: 1,
  },
  inputCidade: {
    flex: 1,
  },
  inputEstado: {
    width: 129,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  input: {
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#E5102E',
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
});

