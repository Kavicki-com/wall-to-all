import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SubscriptionStatusCard from '../components/subscription/SubscriptionStatusCard';
import SubscriptionPaymentRow from '../components/subscription/SubscriptionPaymentRow';
import SubscriptionInvoiceList from '../components/subscription/SubscriptionInvoiceList';
import type {
  Subscription,
  SubscriptionInvoice,
  SubscriptionPlan,
} from '../lib/services/subscriptionTypes';

const plan: SubscriptionPlan = {
  id: 'plan_premium_monthly',
  name: 'Wall to All Premium',
  badge: 'PLANO ÚNICO',
  description: 'Acesso completo à plataforma para o seu negócio crescer.',
  priceCents: 2990,
  interval: 'month',
  features: [],
};

const active: Subscription = {
  id: 'sub_1',
  planId: plan.id,
  priceCents: 2990,
  status: 'active',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: '2026-06-14T12:00:00.000Z',
  card: { id: 'card_visa_1', brand: 'visa', last4: '4242' },
};

function invoices(count: number): SubscriptionInvoice[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `inv_${i}`,
    amountCents: 2990,
    status: 'paid',
    createdAt: new Date(Date.UTC(2026, 4 - i, 14, 12)).toISOString(),
  }));
}

describe('SubscriptionStatusCard', () => {
  it('shows an active subscription with the next charge', () => {
    render(<SubscriptionStatusCard subscription={active} plan={plan} />);
    expect(screen.getByText('ATIVO')).toBeTruthy();
    expect(screen.getByText('Wall to All Premium')).toBeTruthy();
    expect(screen.getByText('R$ 29,90 • cobrado mensalmente')).toBeTruthy();
    expect(screen.getByText('Próxima cobrança em 14 jun 2026')).toBeTruthy();
  });

  it('flags a past due subscription', () => {
    render(<SubscriptionStatusCard subscription={{ ...active, status: 'past_due' }} plan={plan} />);
    expect(screen.getByText('PAGAMENTO PENDENTE')).toBeTruthy();
    expect(screen.getByText('Atualize a forma de pagamento para manter o acesso.')).toBeTruthy();
  });

  it('shows the access end when the cancellation is scheduled', () => {
    render(
      <SubscriptionStatusCard subscription={{ ...active, cancelAtPeriodEnd: true }} plan={plan} />,
    );
    expect(screen.getByText('CANCELAMENTO AGENDADO')).toBeTruthy();
    expect(screen.getByText('Acesso até 14 jun 2026')).toBeTruthy();
    expect(screen.queryByText(/Próxima cobrança/)).toBeNull();
  });
});

describe('SubscriptionPaymentRow', () => {
  it('shows the card and calls onChange', () => {
    const onChange = jest.fn();
    render(<SubscriptionPaymentRow card={active.card} onChange={onChange} />);
    expect(screen.getByText('Pagamento com Cartão')).toBeTruthy();
    expect(screen.getByText('•••• 4242')).toBeTruthy();
    expect(screen.getByTestId('card-brand-visa')).toBeTruthy();
    fireEvent.press(screen.getByText('Alterar'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows a placeholder without card and still allows changing', () => {
    const onChange = jest.fn();
    render(<SubscriptionPaymentRow card={null} onChange={onChange} />);
    expect(screen.getByText('Nenhum cartão')).toBeTruthy();
    fireEvent.press(screen.getByText('Alterar'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('SubscriptionInvoiceList', () => {
  it('shows the four most recent invoices and expands to all', () => {
    render(<SubscriptionInvoiceList invoices={invoices(6)} />);
    expect(screen.getByText('14 mai 2026')).toBeTruthy();
    expect(screen.getAllByText('R$ 29,90')).toHaveLength(4);
    expect(screen.getAllByText('Pago')).toHaveLength(4);
    expect(screen.queryByText('14 dez 2025')).toBeNull();

    fireEvent.press(screen.getByText('Ver todas as faturas'));
    expect(screen.getAllByText('Pago')).toHaveLength(6);
    expect(screen.getByText('14 dez 2025')).toBeTruthy();
    expect(screen.queryByText('Ver todas as faturas')).toBeNull();
  });

  it('labels open invoices as pending', () => {
    const list = invoices(2);
    list[0] = { ...list[0], status: 'open' };
    render(<SubscriptionInvoiceList invoices={list} />);
    expect(screen.getByText('Pendente')).toBeTruthy();
    expect(screen.getAllByText('Pago')).toHaveLength(1);
  });

  it('hides the expand link with four or fewer invoices', () => {
    render(<SubscriptionInvoiceList invoices={invoices(4)} />);
    expect(screen.queryByText('Ver todas as faturas')).toBeNull();
  });

  it('shows an empty state', () => {
    render(<SubscriptionInvoiceList invoices={[]} />);
    expect(screen.getByText('Nenhuma cobrança ainda')).toBeTruthy();
  });
});
