import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../../components/ui/Icon';
import ScreenContainer from '../../components/layout/ScreenContainer';
import SignupHeader from '../../components/auth/SignupHeader';
import { CustomButton } from '../../components/CustomButton';
import { SelectableCard } from '../../components/ui/SelectableCard';
import { useSafeGoBack } from '../../lib/router-utils';

type UserType = 'merchant' | 'client';

const UserTypeSelectionScreen: React.FC = () => {
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/(auth)/login');
  const [selectedType, setSelectedType] = useState<UserType | null>(null);

  const handleContinue = async () => {
    if (!selectedType) return;

    // Sempre redirecionar para a tela de dados pessoais
    // A tela de dados pessoais irá pré-preencher os campos se for OAuth
    if (selectedType === 'merchant') {
      router.replace('/(auth)/merchant-signup-personal');
    } else {
      router.replace('/(auth)/client-signup-personal');
    }
  };

  const handleSelect = (type: UserType) => {
    setSelectedType(type);
  };

  const getColor = (type: UserType) => {
    return selectedType === type ? '#000E3D' : '#0F0F0F';
  };

  return (
    <ScreenContainer
      scroll
      backgroundColor="#FAFAFA"
      hasTabBar={false}
      horizontalPadding={0}
      contentContainerStyle={{ flexGrow: 1 }}
      header={
        <SignupHeader
          title="Selecione o seu tipo de perfil"
          subtitle="Vamos começar o seu cadastro"
          showBackButton={true}
          onPressBack={safeGoBack}
        />
      }
      footer={
        <View style={styles.footerWrapper}>
          <CustomButton
            title="Continuar"
            onPress={handleContinue}
            disabled={!selectedType}
            variant="primary"
            width="100%"
            style={styles.footerButton}
          />
        </View>
      }
    >
      <View style={styles.mainWrapper}>
        <View style={styles.contentContainer}>
          
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

          <View style={styles.cardsBlock}>
            <SelectableCard
              selected={selectedType === 'merchant'}
              onPress={() => handleSelect('merchant')}
              leftIcon={
                <Icon 
                  name="handyman" 
                  family="MaterialSymbols" 
                  size={24} 
                  color={getColor('merchant')} 
                />
              }
            >
              <Text style={[styles.cardTitle, { color: getColor('merchant') }]}>
                Quero prestar serviços
              </Text>
              <Text style={[styles.cardSubtitle, { color: getColor('merchant') }]}>
                Sou prestador de serviços ou tenho um negócio
              </Text>
            </SelectableCard>

            <SelectableCard
              selected={selectedType === 'client'}
              onPress={() => handleSelect('client')}
              leftIcon={
                <Icon 
                  name="handshake" 
                  family="MaterialSymbols" 
                  size={24} 
                  color={getColor('client')} 
                />
              }
            >
              <Text style={[styles.cardTitle, { color: getColor('client') }]}>
                Quero contratar serviços
              </Text>
              <Text style={[styles.cardSubtitle, { color: getColor('client') }]}>
                Sou um cliente e quero contratar serviços para mim
              </Text>
            </SelectableCard>
          </View>

        </View>
      </View>
    </ScreenContainer>
  );
};

export default UserTypeSelectionScreen;

const styles = StyleSheet.create({
  mainWrapper: {
    width: '100%',
    marginTop: 24, 
    paddingBottom: 100,
    paddingHorizontal: 24,
  },
  contentContainer: {
    width: '100%',
    gap: 52,
  },
  descriptionBlock: {
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 15,
    // Aumentado para 48 para forçar a quebra idêntica ao design objetivo
    paddingRight: 48, 
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: '#E5102E',
    textAlign: 'left',
  },
  sectionBody: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    color: '#0F0F0F',
    textAlign: 'left',
    lineHeight: 24,
  },
  cardsBlock: {
    width: '100%',
    gap: 24,
  },
  cardTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
  },
  cardSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    marginTop: 4,
  },
  footerWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  footerButton: {
    borderRadius: 24,
    shadowColor: 'rgba(29, 29, 29, 0.24)',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 1,
    elevation: 4,
  },
});