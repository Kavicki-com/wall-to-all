import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { CustomButton } from '../../../components/CustomButton';
import { safeGoBack } from '../../../lib/router-utils';

const TERMS_CONTENT = `
Termos de Uso – Wall to All

1. Aceitação dos Termos

1.1. Ao acessar ou utilizar o aplicativo Wall to All, o usuário (cliente ou logista) declara ter lido, compreendido e aceitado integralmente os presentes Termos de Uso e a Política de Privacidade.
1.2. Caso não concorde com qualquer disposição, o usuário não deverá utilizar a plataforma.

2. Definições

• Aplicativo: Plataforma digital "Wall to All", destinada a intermediar agendamento de serviços entre clientes e logistas.
• Cliente/Usuário: Pessoa física ou jurídica que utiliza o aplicativo para pesquisar, agendar e contratar serviços.
• Logista/Prestador de Serviços: Pessoa física ou jurídica cadastrada na plataforma para oferecer seus serviços a clientes.
• Conta: Perfil único criado no aplicativo, pessoal e intransferível.
• Agendamento: Registro de contratação de um serviço, com data, horário, valor e condições definidas.

3. Cadastro e Acesso

3.1. Para utilizar o aplicativo, é necessário criar uma conta, informando dados corretos, completos e atualizados.
3.2. É proibido criar contas falsas, duplicadas ou com informações de terceiros.
3.3. O usuário é responsável por manter a confidencialidade de seu login e senha.

4. Responsabilidades dos Clientes

4.1. Fornecer informações corretas ao solicitar um serviço.
4.2. Respeitar horários e condições estabelecidas no momento do agendamento.
4.3. Realizar pagamentos dentro dos prazos e meios disponibilizados.
4.4. Cancelar agendamentos dentro das regras definidas pelo logista.
4.5. Avaliar logistas de forma respeitosa e baseada na experiência real.

5. Responsabilidades dos Logistas

5.1. Manter informações atualizadas sobre serviços, preços, duração, horários e condições.
5.2. Garantir que os serviços ofertados correspondem à realidade.
5.3. Cumprir pontualmente os serviços agendados pelos clientes.
5.4. Possuir todas as licenças, autorizações, registros profissionais e sanitários necessários para a execução do serviço.
5.5. Tratar os clientes com cordialidade, respeito e profissionalismo.
5.6. Informar claramente a política de cancelamento, reembolso e reagendamento.

6. Intermediação da Plataforma

6.1. O Wall to All atua apenas como intermediador tecnológico, não sendo parte da relação contratual entre cliente e logista.
6.2. A plataforma não garante a qualidade, pontualidade ou resultado dos serviços prestados.
6.3. Eventuais conflitos entre cliente e logista deverão ser solucionados entre as partes, sem responsabilidade do Wall to All, salvo quando a plataforma intermediar pagamentos.

7. Pagamentos

7.1. Os pagamentos poderão ser realizados:
• Diretamente ao logista (fora do aplicativo, sob responsabilidade das partes);
• Por meio do aplicativo (quando disponível), com intermediação da plataforma.
7.2. O Wall to All poderá cobrar taxas de intermediação e/ou serviço, previamente informadas ao usuário.
7.3. Em caso de pagamento intermediado, os valores só serão repassados ao logista após a confirmação do serviço.

8. Cancelamentos, Reembolsos e Reagendamentos

8.1. A política de cancelamento e reembolso será definida pelo logista e exibida no aplicativo.
8.2. Em caso de pagamento intermediado, o Wall to All seguirá a política estabelecida pelo logista.
8.3. O não comparecimento do cliente sem aviso prévio dentro do prazo estipulado poderá implicar em cobrança integral.
8.4. O logista que descumprir agendamentos poderá sofrer sanções, como suspensão da conta.

9. Avaliações e Comentários

9.1. Os clientes poderão avaliar os serviços prestados e deixar comentários.
9.2. É vedada a publicação de conteúdo ofensivo, discriminatório, difamatório ou inverídico.
9.3. O Wall to All poderá remover avaliações que violem estes termos.

10. Privacidade e Proteção de Dados

10.1. O tratamento de dados pessoais seguirá a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018).
10.2. Informações coletadas serão usadas para funcionamento do aplicativo, comunicação entre partes e melhoria da experiência.
10.3. Dados de pagamento são processados por parceiros financeiros, não sendo armazenados pelo Wall to All.

11. Direitos de Propriedade Intelectual

11.1. Todos os direitos sobre o aplicativo, design, marcas, logotipos e funcionalidades pertencem ao Wall to All.
11.2. É proibida a cópia, reprodução, engenharia reversa ou uso indevido da plataforma.

12. Suporte e Comunicação

12.1. O usuário poderá entrar em contato com o suporte pelo aplicativo ou canais oficiais.
12.2. O Wall to All poderá enviar notificações, alertas e comunicações relacionadas ao uso da plataforma.

13. Penalidades

13.1. O descumprimento destes termos poderá resultar em:
• Advertência;
• Suspensão temporária da conta;
• Exclusão definitiva da conta;
• Responsabilização civil e criminal.

14. Alterações nos Termos

14.1. O Wall to All poderá alterar estes Termos de Uso a qualquer momento.
14.2. A versão atualizada sempre estará disponível no aplicativo e o uso contínuo implica aceitação.

15. Foro

15.1. Fica eleito o foro da comarca de [cidade/estado a definir], com exclusão de qualquer outro, para dirimir eventuais controvérsias decorrentes destes termos.
`;

const TermsScreen: React.FC = () => {

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={() => safeGoBack('/(merchant)/settings')}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Termos de uso Wall to All</Text>
          <View style={styles.scrollContainer}>
            <ScrollView 
              style={styles.contentScroll} 
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <Text style={styles.contentText}>{TERMS_CONTENT}</Text>
            </ScrollView>
          </View>
          <CustomButton
            title="Fechar"
            variant="outline"
            onPress={() => safeGoBack('/(merchant)/settings')}
            style={{ borderRadius: 24, width: 256, alignSelf: 'center' }}
          />
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
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    textAlign: 'center',
    marginBottom: 16,
  },
  scrollContainer: {
    height: 400,
    marginBottom: 16,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 8,
  },
  contentText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#000000',
    lineHeight: 18,
  },
});




















