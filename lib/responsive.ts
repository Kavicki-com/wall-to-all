/**
 * Sistema de Utilitários Responsivos
 * 
 * Fornece funções e hooks para criar layouts responsivos que se adaptam
 * a diferentes tamanhos de tela, mantendo as proporções do design base.
 * 
 * Design base: iPhone 12/13/14 (390x844)
 */

import { Dimensions, useWindowDimensions } from 'react-native';

// Breakpoints baseados em dispositivos comuns
export const BREAKPOINTS = {
  small: 375,   // iPhone SE, iPhone 8
  medium: 390,  // iPhone 12, 13, 14 (design base)
  large: 428,   // iPhone 14 Pro Max
  tablet: 768,  // iPad Mini
  tabletLarge: 1024, // iPad Pro
} as const;

// Dimensões base do design (iPhone 12/13/14)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/**
 * Obter dimensões da tela (não reativo)
 * Use quando não precisa reagir a mudanças de dimensão
 */
export const getScreenDimensions = () => {
  return Dimensions.get('window');
};

/**
 * Calcular largura responsiva baseada no design base
 * 
 * @param baseWidth - Largura base do design (ex: 342)
 * @returns Largura escalada proporcionalmente
 * 
 * @example
 * const formWidth = responsiveWidth(342); // Escala baseado na largura da tela
 */
export const responsiveWidth = (baseWidth: number): number => {
  const { width } = Dimensions.get('window');
  const scale = width / BASE_WIDTH;
  return baseWidth * scale;
};

/**
 * Calcular altura responsiva baseada no design base
 * 
 * @param baseHeight - Altura base do design (ex: 129)
 * @returns Altura escalada proporcionalmente
 * 
 * @example
 * const headerHeight = responsiveHeight(129); // Escala baseado na altura da tela
 */
export const responsiveHeight = (baseHeight: number): number => {
  const { height } = Dimensions.get('window');
  const scale = height / BASE_HEIGHT;
  return baseHeight * scale;
};

/**
 * Calcular tamanho de fonte responsivo
 * 
 * @param baseSize - Tamanho de fonte base (ex: 16)
 * @returns Tamanho de fonte escalado proporcionalmente
 * 
 * @example
 * const fontSize = responsiveFontSize(16); // Escala baseado na largura da tela
 */
export const responsiveFontSize = (baseSize: number): number => {
  const { width } = Dimensions.get('window');
  const scale = width / BASE_WIDTH;
  return baseSize * scale;
};

/**
 * Hook para dimensões reativas (atualiza em rotação de tela)
 * 
 * Use dentro de componentes funcionais quando precisa reagir a mudanças
 * de dimensão (ex: rotação de tela)
 * 
 * @returns Objeto com width e height atualizados
 * 
 * @example
 * const Component = () => {
 *   const { width, height } = useResponsiveDimensions();
 *   // width e height atualizam automaticamente em rotação
 * };
 */
export const useResponsiveDimensions = () => {
  const { width, height } = useWindowDimensions();
  return { width, height };
};

/**
 * Hook para largura responsiva reativa
 * 
 * @param baseWidth - Largura base do design
 * @returns Largura escalada que atualiza em rotação
 * 
 * @example
 * const Component = () => {
 *   const formWidth = useResponsiveWidth(342);
 *   // formWidth atualiza automaticamente em rotação
 * };
 */
export const useResponsiveWidth = (baseWidth: number): number => {
  const { width } = useWindowDimensions();
  const scale = width / BASE_WIDTH;
  return baseWidth * scale;
};

/**
 * Hook para altura responsiva reativa
 * 
 * @param baseHeight - Altura base do design
 * @returns Altura escalada que atualiza em rotação
 * 
 * @example
 * const Component = () => {
 *   const headerHeight = useResponsiveHeight(129);
 *   // headerHeight atualiza automaticamente em rotação
 * };
 */
export const useResponsiveHeight = (baseHeight: number): number => {
  const { height } = useWindowDimensions();
  const scale = height / BASE_HEIGHT;
  return baseHeight * scale;
};

/**
 * Verificar se o dispositivo é tablet
 * 
 * @returns true se a largura da tela >= 768px
 * 
 * @example
 * if (isTablet()) {
 *   // Layout específico para tablet
 * }
 */
export const isTablet = (): boolean => {
  const { width } = Dimensions.get('window');
  return width >= BREAKPOINTS.tablet;
};

/**
 * Verificar se é tela pequena
 * 
 * @returns true se a largura da tela < 390px
 * 
 * @example
 * if (isSmallScreen()) {
 *   // Ajustes para telas pequenas
 * }
 */
export const isSmallScreen = (): boolean => {
  const { width } = Dimensions.get('window');
  return width < BREAKPOINTS.medium;
};

/**
 * Verificar se é tela grande
 * 
 * @returns true se a largura da tela >= 428px
 */
export const isLargeScreen = (): boolean => {
  const { width } = Dimensions.get('window');
  return width >= BREAKPOINTS.large;
};

/**
 * Calcular largura de card baseada em número de colunas
 * 
 * Útil para grids responsivos onde você quer um número específico
 * de colunas com padding e gap definidos
 * 
 * @param columns - Número de colunas desejadas
 * @param padding - Padding horizontal total (padrão: 24)
 * @param gap - Gap entre cards (padrão: 16)
 * @returns Largura calculada para cada card
 * 
 * @example
 * // Para 2 colunas com padding 24 e gap 10
 * const cardWidth = calculateCardWidth(2, 24, 10);
 * 
 * @example
 * // Para grid responsivo que se adapta
 * const Component = () => {
 *   const { width } = useResponsiveDimensions();
 *   const columns = width >= BREAKPOINTS.tablet ? 3 : 2;
 *   const cardWidth = calculateCardWidth(columns, 24, 16);
 * };
 */
export const calculateCardWidth = (
  columns: number,
  padding: number = 24,
  gap: number = 16
): number => {
  const { width } = Dimensions.get('window');
  const totalPadding = padding * 2;
  const totalGaps = gap * (columns - 1);
  return (width - totalPadding - totalGaps) / columns;
};

/**
 * Hook para calcular largura de card reativa
 * 
 * @param columns - Número de colunas
 * @param padding - Padding horizontal total
 * @param gap - Gap entre cards
 * @returns Largura calculada que atualiza em rotação
 */
export const useCardWidth = (
  columns: number,
  padding: number = 24,
  gap: number = 16
): number => {
  const { width } = useWindowDimensions();
  const totalPadding = padding * 2;
  const totalGaps = gap * (columns - 1);
  return (width - totalPadding - totalGaps) / columns;
};

/**
 * Limitar valor entre mínimo e máximo
 * 
 * Útil para garantir que valores responsivos não fiquem muito
 * pequenos ou grandes
 * 
 * @param value - Valor a limitar
 * @param min - Valor mínimo
 * @param max - Valor máximo
 * @returns Valor limitado
 * 
 * @example
 * const width = clamp(responsiveWidth(342), 300, 400);
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

