import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeGoBack } from '../../lib/router-utils';
import { CustomInput } from '../../components/ui/CustomInput';
import { useToast } from '../../components/ui/ToastProvider';
import { handleError } from '../../lib/errorHandler';
import ScreenContainer from '../../components/layout/ScreenContainer';
import SignupHeaderClient from '../../components/auth/SignupHeaderClient';
import { CustomButton } from '../../components/CustomButton';
import { logger } from '../../lib/logger';

const ClientSignupAddressScreen: React.FC = () => {
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/(auth)/client-signup-personal');
  const { showError } = useToast();
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

  const draftKey = 'client_signup_draft';

  // Carregar draft na montagem inicial
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
      const url = `https://viacep.com.br/ws/${cepValue}/json/`;
      
      let response: Response;
      let timeoutId: NodeJS.Timeout | null = null;
      try {
        // Adicionar timeout de 10 segundos para evitar que fique travado
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 10000);
        
        response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      } catch (fetchError: unknown) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        // Se foi timeout, não propagar o erro - usuário pode preencher manualmente
        if (fetchError && typeof fetchError === 'object' && 'name' in fetchError && fetchError.name === 'AbortError') {
          if (__DEV__) {
            logger.warn('[ViaCEP] Timeout ao buscar CEP. Preencha o endereço manualmente.');
          }
          return;
        }
        throw fetchError;
      }
      
      if (!response.ok) {
        try {
          await response.text();
        } catch {
          // Ignora erro ao ler body
        }
        // ViaCEP temporariamente indisponível - usuário pode preencher manualmente
        // Usar console.warn em vez de console.error para não poluir logs (é um erro esperado de API externa)
        if (__DEV__) {
          logger.warn(`[ViaCEP] Serviço temporariamente indisponível (HTTP ${response.status}). Preencha o endereço manualmente.`);
        }
        return;
      }

      let data: { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      try {
        data = await response.json();
      } catch (jsonError) {
        throw jsonError;
      }

      if (!data.erro) {
        setEndereco(data.logradouro || '');
        setBairro(data.bairro || '');
        setCidade(data.localidade || '');
        setEstado(data.uf || '');
      }
    } catch (error) {
      // Erro de rede/timeout - usuário pode preencher manualmente
      // Usar console.warn em vez de console.error para não poluir logs (é um erro esperado)
      if (__DEV__) {
        logger.warn('[ViaCEP] Erro ao buscar CEP. Preencha o endereço manualmente:', error);
      }
      // Não mostrar alerta para não interromper o fluxo do usuário
    }
  };


  const handleContinue = async () => {
    // Validar CEP: deve ter 8 dígitos numéricos
    const cepDigits = cep.replace(/\D/g, '');
    if (!cepDigits || cepDigits.length !== 8) {
      setError('CEP deve conter 8 dígitos.');
      return;
    }

    if (!endereco || !numero || !bairro || !cidade || !estado) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Buscar dados pessoais salvos anteriormente
      const stored = await AsyncStorage.getItem(draftKey);
      
      if (!stored) {
        setError('Dados do cadastro não encontrados. Por favor, volte e preencha novamente.');
        return;
      }

      let draftData;
      try {
        draftData = JSON.parse(stored);
      } catch (parseError) {
        logger.error('[ClientSignupAddress] Erro ao fazer parse do draft:', parseError);
        await AsyncStorage.removeItem(draftKey);
        setError('Dados do cadastro corrompidos. Por favor, volte e preencha novamente.');
        return;
      }

      // Adicionar dados de endereço ao draft
      const updatedDraft = {
        ...draftData,
        address: `${endereco}, ${numero}${complemento ? ` - ${complemento}` : ''}, ${bairro}, ${cidade} - ${estado}, CEP: ${cep}`,
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
      };

      // Salvar dados atualizados no AsyncStorage
      await AsyncStorage.setItem(draftKey, JSON.stringify(updatedDraft));

      // Navegar para loading screen (onde o usuário será criado)
      router.replace('/(auth)/client-signup-loading');
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
        <SignupHeaderClient
          title="Dados de endereço"
          subtitle="Adicione seu endereço"
          steps={['Cadastro', 'Endereço']}
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
          {/* CEP */}
          <CustomInput
            label="CEP"
            placeholder="00000-000"
            value={cep}
            onChangeText={handleCEPChange}
            keyboardType="numeric"
            maxLength={9}
          />

          {/* Endereço */}
          <CustomInput
            label="Endereço"
            placeholder="Digite sua rua aqui"
            value={endereco}
            onChangeText={setEndereco}
          />

          {/* Complemento */}
          <CustomInput
            label="Complemento"
            placeholder="Selecione aqui"
            value={complemento}
            onChangeText={setComplemento}
          />

          {/* Número e Bairro */}
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

          {/* Cidade e Estado */}
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

          {/* Continue Button */}
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

export default ClientSignupAddressScreen;

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