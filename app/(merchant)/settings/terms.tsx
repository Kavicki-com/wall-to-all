import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';

const TERMS_CONTENT = `
1. Aceitação dos Termos

Ao utilizar o aplicativo Wall to All, você concorda com estes Termos de Uso. Caso não concorde com alguma condição, não utilize a plataforma.

2. Definições

• Aplicativo: Wall to All, plataforma digital para agendamento de serviços.
• Cliente/Usuário: Pessoa física ou jurídica que utiliza o aplicativo para buscar e agendar serviços.
• Logista/Prestador de Serviços: Pessoa física ou jurídica que oferece seus serviços na plataforma.

3. Cadastro e Responsabilidade das Informações

• Clientes devem fornecer dados reais (nome, contato, CPF/CNPJ quando aplicável).
• Logistas devem fornecer dados comerciais verídicos (razão social, endereço, CNPJ/CPF, descrição dos serviços).
• O usuário é responsável pela veracidade e atualização de suas informações.

4. Uso da Plataforma

• O Wall to All é apenas intermediador entre clientes e logistas.
• A plataforma não garante a execução, qualidade ou conclusão dos serviços contratados.
• É vedado o uso do aplicativo para fins ilegais, fraudulentos ou que violem direitos de terceiros.

5. Obrigações dos Logistas

• Manter informações atualizadas sobre serviços, preços, horários e políticas de cancelamento.
• Cumprir os serviços agendados conforme descritos no aplicativo.
• Garantir que possuem licenças, alvarás ou certificações necessárias (quando aplicável).
• Tratar clientes com respeito, zelando por qualidade e segurança.

6. Obrigações dos Clientes

• Agendar serviços de forma responsável, respeitando horários e condições informadas.
• Fornecer informações corretas sobre o serviço solicitado.
• Efetuar pagamentos dentro das condições estabelecidas (quando realizados pelo app).
• Cancelar agendamentos dentro do prazo informado pelo logista.

7. Pagamentos

• Quando o pagamento for feito via aplicativo, este apenas intermediará a transação entre cliente e logista.
• Tarifas e condições de reembolso estarão descritas no momento da contratação.

8. Cancelamentos e Reembolsos

• A política de cancelamento é definida pelo logista e exibida no aplicativo.
• O Wall to All não se responsabiliza por devoluções fora das regras estabelecidas pelo prestador.

9. Limitação de Responsabilidade

• O aplicativo não se responsabiliza por perdas, danos, atrasos, acidentes ou quaisquer prejuízos resultantes de serviços contratados via plataforma.
• O Wall to All atua somente como intermediador tecnológico.

10. Privacidade e Proteção de Dados

• O tratamento de dados pessoais seguirá a Lei Geral de Proteção de Dados (LGPD – Lei 13.709/18).
• Dados coletados serão usados apenas para fins de cadastro, comunicação e funcionamento do aplicativo.

11. Penalidades e Suspensão

• O Wall to All pode suspender ou excluir contas em casos de fraude, descumprimento dos termos ou má conduta.

12. Alterações dos Termos

• Estes termos podem ser atualizados a qualquer momento. A versão vigente sempre estará disponível no aplicativo.

13. Foro

• Fica eleito o foro da comarca de [cidade/estado a definir] para dirimir eventuais litígios relacionados a estes termos.
`;

const TermsScreen: React.FC = () => {
  const router = useRouter();

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={() => router.back()}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Termos de uso Wall to All</Text>
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={true}>
            <Text style={styles.contentText}>{TERMS_CONTENT}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default TermsScreen;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    width: '100%',
    maxWidth: 342,
    maxHeight: '80%',
    gap: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    textAlign: 'center',
  },
  contentScroll: {
    flex: 1,
    maxHeight: 400,
  },
  contentText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#000000',
    lineHeight: 18,
  },
  closeButton: {
    width: 256,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
    alignSelf: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#000E3D',
  },
});




















