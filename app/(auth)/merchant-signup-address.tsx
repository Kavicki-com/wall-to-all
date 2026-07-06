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
import {
  validateCEP,
  validateCity,
  validateAddressNumber,
  validateNeighborhood,
  BRAZILIAN_STATES
} from '../../lib/validations';
import SelectDropdown from '../../components/ui/SelectDropdown';
import { colors } from '../../lib/theme';

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
  const [estado, setEstado] = useState<{ label: string; value: string } | null>(null);

  // Field errors
  const [errors, setErrors] = useState<{
    cep?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  }>({});

  const isFormValid = () => {
    return (
      validateCEP(cep) &&
      endereco.length >= 3 &&
      validateAddressNumber(numero) &&
      validateNeighborhood(bairro) &&
      validateCity(cidade) &&
      estado !== null
    );
  };

  const formatCEP = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 5) {
      return cleaned;
    }
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
  };

  const handleCEPChange = async (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const formatted = formatCEP(text);
    setCep(formatted);

    if (cleaned.length === 8) {
      setErrors(prev => ({ ...prev, cep: undefined }));
      await fetchAddressByCEP(cleaned);
    } else if (text.length > 0 && cleaned.length < 8) {
      setErrors(prev => ({ ...prev, cep: 'CEP inválido' }));
    } else {
      setErrors(prev => ({ ...prev, cep: undefined }));
    }
  };

  const handleCidadeChange = (text: string) => {
    // Proibir estritamente qualquer caractere numérico (0-9) em tempo real
    const filtered = text.replace(/[0-9]/g, '');
    setCidade(filtered);

    if (filtered.length > 0 && !validateCity(filtered)) {
      setErrors(prev => ({ ...prev, cidade: 'Cidade não pode conter números' }));
    } else {
      setErrors(prev => ({ ...prev, cidade: undefined }));
    }
  };

  const handleNumeroChange = (text: string) => {
    if (text.length > 10) return;
    setNumero(text);
    if (text.length > 0 && !validateAddressNumber(text)) {
      setErrors(prev => ({ ...prev, numero: 'Número inválido' }));
    } else {
      setErrors(prev => ({ ...prev, numero: undefined }));
    }
  };

  const handleBairroChange = (text: string) => {
    setBairro(text);
    if (text.length > 0 && !validateNeighborhood(text)) {
      setErrors(prev => ({ ...prev, bairro: 'Bairro inválido' }));
    } else {
      setErrors(prev => ({ ...prev, bairro: undefined }));
    }
  };

  const handleEnderecoChange = (text: string) => {
    setEndereco(text);
    if (text.length > 0 && text.length < 3) {
      setErrors(prev => ({ ...prev, endereco: 'Endereço muito curto' }));
    } else {
      setErrors(prev => ({ ...prev, endereco: undefined }));
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

        const foundState = BRAZILIAN_STATES.find(s => s.value === data.uf);
        if (foundState) {
          setEstado(foundState);
        }

        // Clear errors for auto-filled fields
        setErrors(prev => ({
          ...prev,
          endereco: undefined,
          bairro: undefined,
          cidade: undefined,
          estado: undefined
        }));
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

  const loadDraft = React.useCallback(async () => {
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
      const foundState = BRAZILIAN_STATES.find(s => s.value === parsed.estado);
      if (foundState) {
        setEstado(foundState);
      }
    } catch {
      // ignore draft errors
    }
  }, [draftKey]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useFocusEffect(
    React.useCallback(() => {
      loadDraft();
      setError(null);
    }, [loadDraft])
  );

  const handleContinue = async () => {
    const isAllValid = isFormValid();
    if (!isAllValid) {
      setError('Por favor, corrija os erros no formulário antes de continuar.');
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
        address: `${endereco}, ${numero}${complemento ? ` - ${complemento}` : ''}, ${bairro}, ${cidade} - ${estado?.value || ''}, CEP: ${cep}`,
        cep,
        cidade,
        estado: estado?.value || '',
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

      router.replace({
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
      backgroundColor={colors.surface}
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
            error={errors.cep}
          />

          <CustomInput
            label="Endereço"
            placeholder="Digite sua rua aqui"
            value={endereco}
            onChangeText={handleEnderecoChange}
            onBlur={() => setEndereco(endereco.trim())}
            error={errors.endereco}
          />

          <CustomInput
            label="Complemento"
            placeholder="Selecione aqui"
            value={complemento}
            onChangeText={setComplemento}
            onBlur={() => setComplemento(complemento.trim())}
          />

          <View style={styles.row}>
            <CustomInput
              label="Número"
              placeholder="número"
              value={numero}
              onChangeText={handleNumeroChange}
              onBlur={() => setNumero(numero.trim())}
              keyboardType="numeric"
              containerStyle={styles.inputNumero}
              error={errors.numero}
              maxLength={10}
            />
            <CustomInput
              label="Bairro"
              placeholder="Digite seu bairro"
              value={bairro}
              onChangeText={handleBairroChange}
              onBlur={() => setBairro(bairro.trim())}
              containerStyle={styles.inputBairro}
              error={errors.bairro}
            />
          </View>

          <View style={styles.row}>
            <CustomInput
              label="Cidade"
              placeholder=""
              value={cidade}
              onChangeText={handleCidadeChange}
              onBlur={() => setCidade(cidade.trim())}
              containerStyle={styles.inputCidade}
              error={errors.cidade}
            />
            <View style={styles.inputEstado}>
              <Text style={styles.selectLabel}>Estado</Text>
              <SelectDropdown
                data={BRAZILIAN_STATES}
                selectedValue={estado}
                onSelect={(item) => {
                  setEstado(item);
                  setErrors(prev => ({ ...prev, estado: undefined }));
                }}
                placeholder="UF"
              />
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <CustomButton
            title="Continuar"
            onPress={handleContinue}
            isLoading={loading}
            disabled={loading || !isFormValid()}
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
    color: colors.accent,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: colors.brand,
    paddingVertical: 14,
  },
  selectLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: colors.brand,
    marginBottom: 4,
  },
});
