import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconHandshake } from '../../lib/assets';
import { IconHandyman } from '../../lib/icons';
import ScreenContainer from '../../components/layout/ScreenContainer';
import SignupHeader from '../../components/auth/SignupHeader';
import { CustomButton } from '../../components/CustomButton';
import { SelectableCard } from '../../components/ui/SelectableCard';

type UserType = 'merchant' | 'client';

const UserTypeSelectionScreen: React.FC = () => {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<UserType | null>(null);

  const handleContinue = () => {
    if (!selectedType) {
      return;
    }

    if (selectedType === 'merchant') {
      // Fluxo de cadastro de lojista - passo 1
      router.replace('/(auth)/merchant-signup-personal');
    } else {
      // Fluxo de cadastro de cliente - passo único + loading
      router.replace('/(auth)/client-signup-personal');
    }
  };

  const handleSelect = (type: UserType) => {
    setSelectedType(type);
  };

  return (
    <ScreenContainer
      scroll
      backgroundColor="#FEFEFE"
      contentContainerStyle={{ paddingTop: 0, paddingBottom: 32, flexGrow: 1 }}
      header={
        <SignupHeader
          title="Selecione o seu tipo de perfil"
          subtitle="Vamos começar o seu cadastro"
          showBackButton={false}
        />
      }
    >
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >

        {/* Conteúdo explicativo e seletores */}
        <View style={styles.contentWrapper}>
            <View style={styles.descriptionBlock}>
              <Text style={styles.sectionTitle}>
                O que você está buscando no app?
              </Text>
              <Text style={styles.sectionBody}>
                No wall to all temos opções para quem quer trabalhar e para
                quem precisa de serviços. Escolha o perfil que mais se adequa a
                sua realidade.
              </Text>
            </View>

            <View style={styles.selectorWrapper}>
              {/* Card: Quero prestar serviços */}
              <SelectableCard
                selected={selectedType === 'merchant'}
                onPress={() => handleSelect('merchant')}
                leftIcon={<IconHandyman width={24} height={24} />}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    selectedType === 'merchant' && styles.cardTitleSelected,
                  ]}
                >
                  Quero prestar serviços
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    selectedType === 'merchant' && styles.cardSubtitleSelected,
                  ]}
                >
                  Sou prestador de serviços ou tenho um negócio
                </Text>
              </SelectableCard>

              {/* Card: Quero contratar serviços */}
              <SelectableCard
                selected={selectedType === 'client'}
                onPress={() => handleSelect('client')}
                leftIcon={<IconHandshake width={24} height={24} />}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    selectedType === 'client' && styles.cardTitleSelected,
                  ]}
                >
                  Quero contratar serviços
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    selectedType === 'client' && styles.cardSubtitleSelected,
                  ]}
                >
                  Sou um cliente e quero contratar serviços para mim
                </Text>
              </SelectableCard>
            </View>
        </View>

        {/* Botão Continuar */}
        <View style={styles.actions}>
          <CustomButton
            title="Continuar"
            onPress={handleContinue}
            disabled={!selectedType}
            variant="primary"
            style={{ borderRadius: 24, marginVertical: 0 }}
            width="100%"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default UserTypeSelectionScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 32,
  },
  contentWrapper: {
    marginTop: 24,
  },
  descriptionBlock: {
    width: '100%',
    marginBottom: 52,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: '#E5102E',
    marginBottom: 8,
  },
  sectionBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  selectorWrapper: {
    width: '100%',
    gap: 24,
  },
  cardTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: '#0F0F0F',
  },
  cardSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  cardTitleSelected: {
    color: '#000E3D', // content/primary
  },
  cardSubtitleSelected: {
    color: '#000E3D', // content/primary
  },
  actions: {
    marginTop: 'auto',
    width: '100%',
  },
});


