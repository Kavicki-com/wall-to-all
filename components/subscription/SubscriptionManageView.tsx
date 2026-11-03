import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CustomButton } from '../CustomButton';
import { colors } from '../../lib/theme';
import SubscriptionStatusCard from './SubscriptionStatusCard';
import SubscriptionPaymentRow from './SubscriptionPaymentRow';
import SubscriptionInvoiceList from './SubscriptionInvoiceList';
import CancelSubscriptionModal from './CancelSubscriptionModal';
import type {
  Subscription,
  SubscriptionInvoice,
  SubscriptionPlan,
} from '../../lib/services/subscriptionTypes';

interface SubscriptionManageViewProps {
  plan: SubscriptionPlan;
  subscription: Subscription;
  invoices: SubscriptionInvoice[];
  onChangeCard: () => void;
  /** Chamado só depois da confirmação no modal. */
  onCancel: () => void;
  onResume: () => void;
  /** Operação em andamento: bloqueia os toques (evita cobrança/cancelamento duplos). */
  busy: boolean;
}

/** Gerenciar assinatura (subscription-manage `2680:177`). */
const SubscriptionManageView: React.FC<SubscriptionManageViewProps> = ({
  plan,
  subscription,
  invoices,
  onChangeCard,
  onCancel,
  onResume,
  busy,
}) => {
  const [confirmVisible, setConfirmVisible] = useState(false);

  const confirmCancel = () => {
    setConfirmVisible(false);
    onCancel();
  };

  return (
    <View style={styles.container}>
      <SubscriptionStatusCard subscription={subscription} plan={plan} />

      <Text style={styles.sectionTitle}>Forma de pagamento</Text>
      <SubscriptionPaymentRow card={subscription.card} onChange={onChangeCard} disabled={busy} />

      <Text style={styles.sectionTitle}>Histórico de cobranças</Text>
      <SubscriptionInvoiceList invoices={invoices} />

      {subscription.cancelAtPeriodEnd ? (
        <CustomButton
          title="Manter assinatura"
          variant="primary"
          onPress={onResume}
          disabled={busy}
          width="100%"
        />
      ) : (
        <CustomButton
          title="Cancelar assinatura"
          variant="outline"
          onPress={() => setConfirmVisible(true)}
          disabled={busy}
          width="100%"
        />
      )}

      <CancelSubscriptionModal
        visible={confirmVisible}
        accessUntil={subscription.currentPeriodEnd}
        onConfirm={confirmCancel}
        onClose={() => setConfirmVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.accent,
  },
});

export default SubscriptionManageView;
