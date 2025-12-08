import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { RadialGradient, LinearGradient } from 'react-native-gradients';
import { useRouter } from 'expo-router';
import {
  IconHandshake,
  IconHandyman,
} from '../../lib/assets';

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
    <View style={styles.background}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header com gradiente radial + linear seguindo o MCP do Figma */}
        <View style={styles.header}>
          {/* Camada de fundo (base + linear + radial) */}
          <View style={styles.headerBackground}>
            {/* 1) var(--surface-primary, #000E3D) */}
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: '#000E3D' },
              ]}
            />
            {/* 2) linear-gradient ajustado para manter a faixa global bem escura */}
            <LinearGradient
              style={StyleSheet.absoluteFillObject}
              angle={0}
              colorList={[
                {
                  offset: '0%',
                  color: 'rgba(0, 14, 61, 0.80)', // base bem escura
                  opacity: '1',
                },
                {
                  offset: '100%',
                  color: 'rgba(0, 14, 61, 0.95)', // topo ainda mais escuro
                  opacity: '1',
                },
              ]}
            />
            {/* 3) radial-gradient: brilho bem suave ocupando a faixa inteira, mais forte perto do texto */}
            <RadialGradient
              style={StyleSheet.absoluteFillObject}
              x={0.5}
              y={0.55}
              rx={2.0}
              ry={1.0}
              colorList={[
                {
                  offset: '0%',
                  color: 'rgba(214, 224, 255, 0.18)', // brilho bem suave
                  opacity: '1',
                },
                {
                  offset: '100%',
                  color: 'rgba(0, 14, 61, 0.00)', // some para o fundo escuro
                  opacity: '1',
                },
              ]}
            />
          </View>

          {/* Conteúdo por cima do gradiente */}
          <View style={styles.headerContent}>
            <Text style={styles.welcomeTitle}>
              Selecione o seu tipo de perfil
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Vamos começar o seu cadastro
            </Text>
          </View>
        </View>

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
              <TouchableOpacity
                style={[
                  styles.card,
                  selectedType === 'merchant' && styles.cardSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => handleSelect('merchant')}
              >
                <View style={styles.cardIconWrapper}>
                  <IconHandyman width={24} height={24} />
                </View>
                <View style={styles.cardTextWrapper}>
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
                      selectedType === 'merchant' &&
                        styles.cardSubtitleSelected,
                    ]}
                  >
                    Sou prestador de serviços ou tenho um negócio
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Card: Quero contratar serviços */}
              <TouchableOpacity
                style={[
                  styles.card,
                  selectedType === 'client' && styles.cardSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => handleSelect('client')}
              >
                <View style={styles.cardIconWrapper}>
                  <IconHandshake width={24} height={24} />
                </View>
                <View style={styles.cardTextWrapper}>
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
                      selectedType === 'client' &&
                        styles.cardSubtitleSelected,
                    ]}
                  >
                    Sou um cliente e quero contratar serviços para mim
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
        </View>

        {/* Botão Continuar */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.buttonContained,
              !selectedType && styles.buttonContainedDisabled,
            ]}
            activeOpacity={0.8}
            onPress={handleContinue}
            disabled={!selectedType}
          >
            <Text style={styles.buttonContainedText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default UserTypeSelectionScreen;

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
    justifyContent: 'space-between',
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
  welcomeTextWrapper: {
    gap: 4,
  },
  welcomeTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: '#FEFEFE',
  },
  welcomeSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#FEFEFE',
  },
  contentWrapper: {
    flex: 1,
    marginTop: 24,
    alignItems: 'center',
  },
  descriptionBlock: {
    width: 342,
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
    width: 342,
    gap: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  cardSelected: {
    backgroundColor: '#D6E0FF', // surface/primary-light
    borderWidth: 2,
    borderColor: '#000E3D', // border/primary
  },
  cardIconWrapper: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardTextWrapper: {
    flex: 1,
    gap: 8,
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
    width: 342,
    alignSelf: 'center',
    paddingBottom: 32,
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
  buttonContainedDisabled: {
    opacity: 0.4,
  },
  buttonContainedText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: '#FEFEFE',
  },
});


