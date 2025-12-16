import React from 'react';
import { ViewStyle, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, View, RefreshControlProps, useWindowDimensions } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

/**
 * Regra de safe area inferior (fonte única de verdade):
 * - Quando a TabBar está visível, ela é a única responsável por aplicar insets.bottom.
 *   Footers de tela nesses cenários não devem adicionar padding extra nem SafeArea.
 * - Quando a TabBar está oculta, o footer da tela deve aplicar insets.bottom para proteger CTA.
 */
export interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  // Permite desativar a safe area se tivermos uma imagem de fundo total
  withSafeArea?: boolean;
  // Controla quais bordas aplicar a safe area (útil quando há header customizado)
  safeAreaEdges?: Edge[];
  // Permite habilitar scroll no container
  scroll?: boolean;
  // Cor de fundo personalizada
  backgroundColor?: string;
  /**
   * Padding horizontal padrão para o conteúdo da tela.
   * Valor padrão: 16px (mobile) / 24px (tablet >= 768px)
   * Use 0 para conteúdo full-bleed (ex: imagens hero que devem estender até as bordas).
   * Quando scroll=true, o padding é aplicado no contentContainerStyle do ScrollView.
   * Exceções conhecidas: store/[id].tsx usa horizontalPadding={0} para hero image full-bleed.
   */
  horizontalPadding?: number;
  // Estilo do contentContainer quando usando scroll
  contentContainerStyle?: ViewStyle;
  // Conteúdo do rodapé (botão principal, etc)
  footer?: React.ReactNode;
  // Indica se a tela tem AppHeader (ajusta safe area automaticamente)
  hasHeader?: boolean;
  // Indica se a TabBar está visível (controla aplicação do bottom safe area no footer)
  hasTabBar?: boolean;
  // Header customizado que será renderizado com largura total (edge-to-edge)
  // Quando fornecido, o header não recebe paddingHorizontal, permitindo que o gradiente alcance as bordas
  header?: React.ReactNode;
  // RefreshControl para pull-to-refresh
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export default function ScreenContainer({ 
  children, 
  style, 
  withSafeArea = true,
  safeAreaEdges,
  scroll = false,
  backgroundColor,
  horizontalPadding,
  contentContainerStyle,
  footer,
  hasHeader = false,
  hasTabBar = true,
  header,
  refreshControl
}: ScreenContainerProps) {
  // Calcular padding responsivo baseado na largura da tela
  const { width } = useWindowDimensions();
  const DEFAULT_HORIZONTAL_PADDING = width >= 768 ? 24 : 16;
  const finalHorizontalPadding = horizontalPadding ?? DEFAULT_HORIZONTAL_PADDING;
  
  // Calcular edges baseado em hasHeader ou header
  // Se header é fornecido, considerar hasHeader=true automaticamente
  const hasHeaderOrCustomHeader = hasHeader || !!header;
  
  // Quando há scroll, o padding deve ser aplicado no contentContainerStyle, não no container
  // porque o ScrollView não herda padding do container pai
  // Aplicar flexGrow: 1 automaticamente para garantir que conteúdo curto preencha a altura
  // Aplicar paddingTop: 16 quando hasHeader={true} ou header é fornecido para espaçamento consistente abaixo do AppHeader
  // Aplicar paddingBottom quando há footer para garantir que último item não fique escondido
  const baseScrollContentStyle: ViewStyle = {
    flexGrow: 1, // Garante que conteúdo curto preencha a altura da tela
    ...(finalHorizontalPadding !== undefined && { paddingHorizontal: finalHorizontalPadding }),
    ...(hasHeaderOrCustomHeader && !contentContainerStyle?.paddingTop && { paddingTop: 16 }),
    ...(footer && !contentContainerStyle?.paddingBottom && { paddingBottom: 24 }),
  };

  const finalContentContainerStyle = scroll
    ? [
        baseScrollContentStyle,
        contentContainerStyle,
      ]
    : contentContainerStyle;

  const containerStyle: ViewStyle = {
    ...styles.container,
    ...(backgroundColor && { backgroundColor }),
    // Não aplicar padding no container quando há header, pois o header deve ser edge-to-edge
    // O padding será aplicado apenas no conteúdo (contentWrapper ou contentContainerStyle)
    ...style
  };

  const computedEdges = (): Edge[] => {
    if (safeAreaEdges !== undefined) {
      return safeAreaEdges;
    }

    const edges: Edge[] = ['left', 'right'];
    if (!hasHeaderOrCustomHeader) {
      edges.push('top');
    }
    if (!hasTabBar && !footer) {
      edges.push('bottom');
    }
    return edges;
  };

  // Estilo do container do footer - aplicar mesmo padding horizontal que o conteúdo
  const footerContainerStyle: ViewStyle = {
    backgroundColor: 'transparent',
    paddingHorizontal: finalHorizontalPadding,
  };
  
  const renderContent = () => {
    // Container principal que envolve header, conteúdo e footer
    const mainContainerStyle: ViewStyle = {
      flex: 1,
      flexDirection: 'column',
    };

    // Renderizar header com largura total (sem paddingHorizontal)
    const headerContainer = header ? (
      <View style={{ width: '100%' }}>
        {header}
      </View>
    ) : null;

    // Renderizar conteúdo com padding
    const contentWrapper = scroll ? (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={finalContentContainerStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    ) : (
      <View style={{ flex: 1, paddingHorizontal: finalHorizontalPadding }}>
        {children}
      </View>
    );

    const renderFooter = () => {
      if (!footer) return null;

      if (hasTabBar) {
        // TabBar é a dona do insets.bottom; footer sem SafeArea aqui
        return (
          <View style={footerContainerStyle}>
            {footer}
          </View>
        );
      }

      return (
        <SafeAreaView edges={['bottom']} style={footerContainerStyle}>
          {footer}
        </SafeAreaView>
      );
    };

    return (
      <View style={mainContainerStyle}>
        {headerContainer}
        {contentWrapper}
        {renderFooter()}
      </View>
    );
  };
  
  if (withSafeArea) {
    const edges = computedEdges();
    
    return (
      <SafeAreaView 
        style={containerStyle}
        edges={edges}
      >
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
        >
            {renderContent()}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={containerStyle}
    >
        {renderContent()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Cor de fundo padrão
  },
});