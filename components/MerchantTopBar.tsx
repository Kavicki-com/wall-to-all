import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, SafeAreaView, Platform } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { IconBack, IconNotification } from '../lib/icons';
import { safeGoBack } from '../lib/router-utils';

interface MerchantTopBarProps {
  title?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  showNotification?: boolean;
  fallbackPath?: string;
}

export const MerchantTopBar: React.FC<MerchantTopBarProps> = ({
  title,
  showBack = false,
  onBackPress,
  showNotification = true,
  fallbackPath = '/(merchant)/dashboard',
}) => {
  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      safeGoBack(fallbackPath);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. StatusBar Transparente: 
          Para que o gradiente comece desde o topo absoluto da tela 
      */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent 
      />

      {/* 2. CAMADA DE FUNDO */}
      <View style={styles.backgroundLayer}>
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

      {/* 3. CONTEÚDO */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentRow}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              accessibilityHint="Toque para voltar à tela anterior"
            >
              <IconBack size={24} color="#FEFEFE" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
          {title ? (
            <View style={styles.titleContainer}>
              <Text style={styles.topBarTitle}>{title}</Text>
            </View>
          ) : null}
          {/* Lado direito: Ícone de notificação */}
          {showNotification ? (
            <TouchableOpacity 
              activeOpacity={0.7} 
              style={styles.notificationButton}
              accessibilityRole="button"
              accessibilityLabel="Notificações"
              accessibilityHint="Toque para ver suas notificações"
            >
              <IconNotification size={24} color="#FEFEFE" />
            </TouchableOpacity>
          ) : (
            <View style={styles.notificationButton} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    // Sem altura fixa rígida, deixamos o padding do SafeAreaView + content definirem,
    // mas garantimos um minHeight para visual consistente.
    // Aproximadamente 100-110px total em dispositivos modernos.
    minHeight: Platform.OS === 'ios' ? 100 : 80,
    backgroundColor: '#000E3D', // Fallback
    zIndex: 10,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject, // Cobre tudo, inclusive a área da StatusBar
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end', // Garante que o conteúdo fique na parte de baixo da barra
  },
  contentRow: {
    width: '100%',
    height: 56, // Altura exata da área de conteúdo do CSS (sem contar padding)
    flexDirection: 'row',
    justifyContent: 'space-between', // Alinha itens (back/title à esquerda, notification à direita)
    alignItems: 'center', // Centraliza verticalmente no bloco de 56px
    paddingHorizontal: 24,
    // O padding bottom extra ajuda a dar o respiro que existia no design original
    paddingBottom: 8,
  },
  backButton: {
    width: 40, // Área de toque confortável
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start', // Alinha à esquerda
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
    textAlign: 'center',
  },
  notificationButton: {
    width: 40, // Área de toque confortável
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end', // Garante alinhamento visual à direita
  },
});




