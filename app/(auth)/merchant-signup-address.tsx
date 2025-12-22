import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeGoBack } from '../../lib/router-utils';
import { CustomInput } from '../../components/ui/CustomInput';
import { useToast } from '../../components/ui/ToastProvider';
import { handleError } from '../../lib/errorHandler';
import ScreenContainer from '../../components/layout/ScreenContainer';
import SignupHeaderMerchant from '../../components/auth/SignupHeaderMerchant';
import { CustomButton } from '../../components/CustomButton';
import { logger } from '../../lib/logger';

const MerchantSignupAddressScreen: React.FC = () => {
  const { showError } = useToast();
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/(auth)/merchant-signup-personal');
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

    if (formatted.length === 9) {
      await fetchAddressByCEP(formatted.replace('-', ''));
    }
  };

  const fetchAddressByCEP = async (cepValue: string) => {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Adicionar timeout de 10 segundos para evitar que fique travado
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`https://viacep.com.br/ws/${cepValue}/json/`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (!response.ok) {
        // ViaCEP temporariamente indisponível - usuário pode preencher manualmente
        // Usar console.warn em vez de console.error para não poluir logs (é um erro esperado de API externa)
        if (__DEV__) {
          logger.warn(`[ViaCEP] Serviço temporariamente indisponível (HTTP ${response.status}). Preencha o endereço manualmente.`);
        }
        return;
      }

      const data = await response.json();

      if (!data.erro) {
        setEndereco(data.logradouro || '');
        setBairro(data.bairro || '');
        setCidade(data.localidade || '');
        setEstado(data.uf || '');
      }
    } catch (error: unknown) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Erro de rede/timeout - usuário pode preencher manualmente
      // Usar console.warn em vez de console.error para não poluir logs (é um erro esperado)
      if (__DEV__) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
          logger.warn('[ViaCEP] Timeout ao buscar CEP. Preencha o endereço manualmente.');
        } else {
          logger.warn('[ViaCEP] Erro ao buscar CEP. Preencha o endereço manualmente:', error);
        }
      }
      // Não mostrar alerta para não interromper o fluxo do usuário
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

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  // O draft só é carregado no useEffect acima na montagem inicial
  useFocusEffect(
    React.useCallback(() => {
      setCep('');
      setEndereco('');
      setComplemento('');
      setNumero('');
      setBairro('');
      setCidade('');
      setEstado('');
      setError(null);
    }, [])
  );

  const handleContinue = async () => {
    // Validar CEP: deve ter 8 dígitos numéricos
    const cepDigits = cep.replace(/\D/g, '');
    if (!cepDigits || cepDigits.length !== 8) {
      setError('CEP deve conter 8 dígitos.');
      return;
    }

    const requiredFilled = endereco && numero && bairro && cidade && estado;
    if (!requiredFilled) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Buscar dados pessoais salvos anteriormente
      const mainDraftKey = 'merchant_signup_draft';
      const stored = await AsyncStorage.getItem(mainDraftKey);
      
      if (!stored) {
        setError('Dados do cadastro não encontrados. Por favor, volte e preencha novamente.');
        return;
      }

      let draftData;
      try {
        draftData = JSON.parse(stored);
      } catch (parseError) {
        logger.error('[MerchantSignupAddress] Erro ao fazer parse do draft:', parseError);
        await AsyncStorage.removeItem(mainDraftKey);
        setError('Dados do cadastro corrompidos. Por favor, volte e preencha novamente.');
        return;
      }

      const addressData = {
        address: `${endereco}, ${numero}${complemento ? ` - ${complemento}` : ''}, ${bairro}, ${cidade} - ${estado}, CEP: ${cep}`,
        cep,
        cidade,
        estado,
        endereco,
        numero,
        complemento,
        bairro,
      };

      // Adicionar dados de endereço ao draft principal
      const updatedDraft = {
        ...draftData,
        ...addressData,
      };

      // Salvar dados atualizados no AsyncStorage
      await AsyncStorage.setItem(mainDraftKey, JSON.stringify(updatedDraft));

      // Limpar draft local de endereço
      try {
        await AsyncStorage.removeItem(draftKey);
      } catch {
        // ignore cleanup errors
      }

      router.push({
        pathname: '/(auth)/merchant-signup-business',
      });
    } catch (err) {
      const processed = handleError(err, 'signup');
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
          title="Dados de endereço"
          subtitle="Adicione seu endereço"
          steps={['Cadastro', 'Endereço', 'Negócio', 'Serviços']}
          currentStepIndex={1}
          showBackButton={true}
          onPressBack={safeGoBack}
        />
      }
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >

        {/* Form */}
        <View style={styles.form}>
          <CustomInput
            label="CEP"
            placeholder="00000-000"
            value={cep}
            onChangeText={handleCEPChange}
            keyboardType="numeric"
            maxLength={9}
          />

          <CustomInput
            label="Endereço"
            placeholder="Digite sua rua aqui"
            value={endereco}
            onChangeText={setEndereco}
          />

          <CustomInput
            label="Complemento"
            placeholder="Selecione aqui"
            value={complemento}
            onChangeText={setComplemento}
          />

          <View style={styles.row}>
            <CustomInput
              label="Número"
              placeholder="número"
              value={numero}
              onChangeText={setNumero}
              keyboardType="numeric"
              containerStyle={styles.inputNumero}
            />
            <CustomInput
              label="Bairro"
              placeholder="Digite seu bairro"
              value={bairro}
              onChangeText={setBairro}
              containerStyle={styles.inputBairro}
            />
          </View>

          <View style={styles.row}>
            <CustomInput
              label="Cidade"
              placeholder=""
              value={cidade}
              onChangeText={setCidade}
              containerStyle={styles.inputCidade}
            />
            <CustomInput
              label="Estado"
              placeholder="UF"
              value={estado}
              onChangeText={(text) => setEstado(text.toUpperCase())}
              maxLength={2}
              autoCapitalize="characters"
              containerStyle={styles.inputEstado}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <CustomButton
            title="Continuar"
            onPress={handleContinue}
            isLoading={loading}
            disabled={loading}
            variant="primary"
            style={{ borderRadius: 24, marginVertical: 0, marginTop: 24 }}
            width="100%"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default MerchantSignupAddressScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    gap: 16,
  },
  inputNumero: {
    flex: 0.4,
  },
  inputBairro: {
    flex: 1,
  },
  inputCidade: {
    flex: 1,
  },
  inputEstado: {
    flex: 0.5,
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
    paddingVertical: 14,
  },
});