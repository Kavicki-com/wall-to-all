import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IconBack, IconNotification } from '../../../lib/icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    question: 'Quais são as opções de personalização disponíveis no aplicativo Wall to All?',
    answer:
      'O aplicativo Wall to All oferece diversas opções de personalização, incluindo edição de perfil, preferências de notificações, métodos de pagamento favoritos e histórico de serviços contratados.',
  },
  {
    id: '2',
    question: 'Quais são os principais benefícios que o aplicativo Wall to All oferece?',
    answer:
      'O Wall to All oferece acesso rápido a profissionais qualificados, agendamento simplificado, avaliações de outros clientes, múltiplos métodos de pagamento e suporte ao cliente dedicado.',
  },
  {
    id: '3',
    question: 'Como posso alterar minha senha no aplicativo?',
    answer:
      'Para alterar sua senha, acesse "Configurações" > "Alterar Senha" ou "Perfil" > "Editar Perfil" > "Alterar senha". Você precisará informar sua senha atual e criar uma nova senha.',
  },
  {
    id: '4',
    question: 'Qual é o processo para me inscrever no aplicativo Wall to All?',
    answer:
      'O processo de inscrição é simples: baixe o aplicativo, escolha se você é cliente ou lojista, preencha seus dados pessoais e confirme seu e-mail. Em seguida, você já pode começar a usar o aplicativo.',
  },
  {
    id: '5',
    question: 'Como posso excluir minha conta no aplicativo?',
    answer:
      'Para excluir sua conta, acesse "Configurações" > "Excluir Conta". Esta ação é permanente e não pode ser desfeita. Todos os seus dados serão removidos do sistema.',
  },
  {
    id: '6',
    question: 'Quais recursos estão disponíveis no aplicativo Wall to All?',
    answer:
      'O aplicativo oferece busca de profissionais, agendamento de serviços, avaliações, histórico de agendamentos, múltiplos métodos de pagamento, notificações e suporte ao cliente.',
  },
  {
    id: '7',
    question: 'Como posso obter suporte para o aplicativo?',
    answer:
      'Você pode obter suporte através da seção "Configurações" > "Suporte" ou entrando em contato pelo e-mail suporte@walltoall.com. Nossa equipe está disponível para ajudá-lo.',
  },
  {
    id: '8',
    question: 'O aplicativo Wall to All é gratuito ou possui custos?',
    answer:
      'O aplicativo é gratuito para download e uso. Os custos são apenas pelos serviços contratados através da plataforma, que variam de acordo com cada profissional ou loja.',
  },
  {
    id: '9',
    question: 'Quais são os termos de uso do aplicativo?',
    answer:
      'Os termos de uso podem ser acessados através de "Configurações" > "Termos de uso". É importante ler e entender os termos antes de usar o aplicativo.',
  },
  {
    id: '10',
    question: 'Como funciona o suporte ao usuário no aplicativo Wall to All?',
    answer:
      'O suporte ao usuário está disponível através de múltiplos canais: FAQ, e-mail de suporte, chat dentro do aplicativo e seção de ajuda. Nossa equipe responde em até 24 horas.',
  },
  {
    id: '11',
    question: 'Onde posso encontrar a FAQ do aplicativo?',
    answer:
      'A FAQ pode ser acessada através de "Configurações" > "FAQ". Lá você encontrará respostas para as perguntas mais frequentes sobre o uso do aplicativo.',
  },
  {
    id: '12',
    question: 'O aplicativo Wall to All é compatível com dispositivos móveis?',
    answer:
      'Sim, o aplicativo Wall to All foi desenvolvido especificamente para dispositivos móveis (iOS e Android) e oferece uma experiência otimizada para smartphones e tablets.',
  },
];

const FAQScreen: React.FC = () => {
  const router = useRouter();
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
    <View style={styles.container}>
      {/* Top Bar with Gradient */}
      <View style={styles.topBarContainer}>
        <LinearGradient
          colors={['#000E3D', '#000E3D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <RadialGradient
                id="grad"
                cx="50%"
                cy="50%"
                r="50%"
                gradientUnits="userSpaceOnUse"
                gradientTransform="matrix(1 0 0 0.5 0 0)"
              >
                <Stop offset="0%" stopColor="#D6E0FF" />
                <Stop offset="100%" stopColor="#000E3D" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" opacity="0.2" />
          </Svg>
          <View style={styles.topBarContent}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <IconBack size={24} color="#FEFEFE" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>FAQ</Text>
            <IconNotification size={24} color="#FEFEFE" />
          </View>
        </LinearGradient>
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
                <View key={item.id}>
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => toggleItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionText}>{item.question}</Text>
                    <MaterialIcons
                      name={isExpanded ? 'keyboard-arrow-down' : 'keyboard-arrow-right'}
                      size={24}
                      color="#000E3D"
                    />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.answerContainer}>
                      <Text style={styles.answerText}>{item.answer}</Text>
                    </View>
                  )}
                </View>
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
    height: 70,
  },
  headerGradient: {
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 90,
    paddingBottom: 100,
    alignItems: 'center',
  },
  optionsContainer: {
    width: '90%',
    maxWidth: 342,
    alignSelf: 'center',
  },
  optionsList: {
    gap: 12,
  },
  optionItem: {
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
    elevation: 2,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000E3D',
  },
  answerContainer: {
    backgroundColor: '#FEFEFE',
    paddingHorizontal: 8,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  answerText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000E3D',
    lineHeight: 24,
  },
});
