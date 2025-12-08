import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

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

  const handleContinue = async () => {
    if (!cep || !endereco || !numero || !bairro || !cidade || !estado) {
      setError('Preencha todos os campos obrigatórios.');
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

      // Salvar endereço temporariamente no localStorage para usar na próxima tela
      // (business_profiles será criado na tela de negócio com business_name obrigatório)
      const addressData = {
        address: `${endereco}, ${numero}${complemento ? ` - ${complemento}` : ''}, ${bairro}, ${cidade} - ${estado}, CEP: ${cep}`,
      };
      
      // Passar o endereço como parâmetro para a próxima tela
      router.push({
        pathname: '/(auth)/merchant-signup-business',
        params: { 
          userId: user.id,
          addressData: JSON.stringify(addressData),
        },
      });
      return;

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
        {/* Header com gradiente */}
        <View style={styles.headerContainer}>
          <View style={styles.headerGradient} />
          <View style={styles.header}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 124,
    backgroundColor: '#000E3D',
    opacity: 0.2,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    backgroundColor: '#000E3D',
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

