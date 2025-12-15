import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenContainer from '../../../components/layout/ScreenContainer';

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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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
    <ScreenContainer 
      scroll={true}
      hasTabBar={false}
      backgroundColor="#FAFAFA"
      contentContainerStyle={styles.scrollContent}
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
    </ScreenContainer>
  );
};

export default FAQScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 24,
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
