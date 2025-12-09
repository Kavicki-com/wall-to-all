import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { IconBack, IconNotification } from '../../../lib/icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useResponsiveHeight } from '../../../lib/responsive';

type FAQItem = {
  id: string;
  question: string;
};

const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    question: 'Quais são as opções de personalização disponíveis no aplicativo Wall to All?',
  },
  {
    id: '2',
    question: 'Quais são os principais benefícios que o aplicativo Wall to All oferece?',
  },
  {
    id: '3',
    question: 'Como posso alterar minha senha no aplicativo?',
  },
  {
    id: '4',
    question: 'Qual é o processo para me inscrever no aplicativo Wall to All?',
  },
  {
    id: '5',
    question: 'Como posso excluir minha conta no aplicativo?',
  },
  {
    id: '6',
    question: 'Quais recursos estão disponíveis no aplicativo Wall to All?',
  },
  {
    id: '7',
    question: 'Como posso obter suporte para o aplicativo?',
  },
  {
    id: '8',
    question: 'O aplicativo Wall to All é gratuito ou possui custos?',
  },
  {
    id: '9',
    question: 'Quais são os termos de uso do aplicativo?',
  },
  {
    id: '10',
    question: 'Onde posso encontrar a FAQ do aplicativo?',
  },
  {
    id: '11',
    question: 'O aplicativo Wall to All é compatível com dispositivos móveis?',
  },
  {
    id: '12',
    question: 'Como funciona o suporte ao usuário no aplicativo Wall to All?',
  },
];

const FAQScreen: React.FC = () => {
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const topBarHeight = useResponsiveHeight(56); // Altura responsiva do header SVG (viewBox="0 0 410 56")

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <View style={styles.container}>
      {/* Top Bar with Gradient */}
      <View style={styles.topBarContainer}>
        <View style={styles.topBarDivider} />
        <View style={styles.topBarContent}>
          <View style={styles.topBarGradientContainer}>
            <Svg style={[StyleSheet.absoluteFill, { height: topBarHeight }]} viewBox="0 0 410 56" preserveAspectRatio="none">
              <Defs>
                <RadialGradient
                  id="topBarRadialGradient"
                  cx="50%"
                  cy="50%"
                  r="50%"
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%" stopColor="rgba(214,224,255,1)" />
                  <Stop offset="25%" stopColor="rgba(161,172,207,1)" />
                  <Stop offset="37.5%" stopColor="rgba(134,145,182,1)" />
                  <Stop offset="50%" stopColor="rgba(107,119,158,1)" />
                  <Stop offset="62.5%" stopColor="rgba(80,93,134,1)" />
                  <Stop offset="75%" stopColor="rgba(54,67,110,1)" />
                  <Stop offset="87.5%" stopColor="rgba(27,40,85,1)" />
                  <Stop offset="93.75%" stopColor="rgba(13,27,73,1)" />
                  <Stop offset="100%" stopColor="rgba(0,14,61,1)" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="410" height="56" fill="url(#topBarRadialGradient)" opacity={0.2} />
            </Svg>
            <LinearGradient
              colors={['rgba(0, 14, 61, 0.2)', 'rgba(214, 224, 255, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={['rgba(0, 14, 61, 1)', 'rgba(0, 14, 61, 1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.topBarInner}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <IconBack size={24} color="#FEFEFE" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>FAQ</Text>
              <TouchableOpacity style={styles.notificationButton}>
                <IconNotification size={24} color="#FEFEFE" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.optionsContainer}>
          <View style={styles.optionsList}>
            {FAQ_DATA.map((item) => {
              const isExpanded = expandedItems.has(item.id);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.faqItem}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faqQuestionText}>{item.question}</Text>
                  <MaterialIcons
                    name="keyboard-arrow-right"
                    size={24}
                    color="#000E3D"
                    style={[styles.chevronContainer, isExpanded && styles.chevronExpanded]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default FAQScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBarContainer: {
    width: '100%',
  },
  topBarDivider: {
    height: 14,
    backgroundColor: '#EBEFFF',
  },
  topBarContent: {
    height: 56,
  },
  topBarGradientContainer: {
    flex: 1,
    position: 'relative',
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    height: '100%',
  },
  backButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
    textAlign: 'center',
  },
  notificationButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 90,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  optionsList: {
    gap: 12,
  },
  faqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 16,
    gap: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1,
    elevation: 1,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000E3D',
  },
  chevronContainer: {
    transform: [{ rotate: '-90deg' }],
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
});
