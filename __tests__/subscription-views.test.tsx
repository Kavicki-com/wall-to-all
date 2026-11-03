import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SubscriptionOfferView from '../components/subscription/SubscriptionOfferView';
import SubscriptionManageView from '../components/subscription/SubscriptionManageView';
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
  features: [
    'Agendamentos ilimitados',
    'Dashboard completo com métricas',
    'Sistema de indicações (Quem Indica)',
    'Carteira financeira e saques via PIX',
    'Cadastro ilimitado de serviços',
    'Suporte prioritário ao lojista',
  ],
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

const invoices: SubscriptionInvoice[] = [
  { id: 'inv_1', amountCents: 2990, status: 'paid', createdAt: '2026-05-14T12:00:00.000Z' },
];

function renderOffer(overrides: Partial<React.ComponentProps<typeof SubscriptionOfferView>> = {}) {
  const props = {
    plan,
    onSubscribe: jest.fn(),
    onOpenTerms: jest.fn(),
    subscribeDisabled: false,
    ...overrides,
  };
  render(<SubscriptionOfferView {...props} />);
  return props;
}

function renderManage(overrides: Partial<React.ComponentProps<typeof SubscriptionManageView>> = {}) {
  const props = {
    plan,
    subscription: active,
    invoices,
    onChangeCard: jest.fn(),
    onCancel: jest.fn(),
    onResume: jest.fn(),
    busy: false,
    ...overrides,
  };
  render(<SubscriptionManageView {...props} />);
  return props;
}

describe('SubscriptionOfferView', () => {
  it('shows the plan hero, price and the six features', () => {
    renderOffer();
    expect(screen.getByText('PLANO ÚNICO')).toBeTruthy();
    expect(screen.getByText('Wall to All Premium')).toBeTruthy();
    expect(screen.getByText('Acesso completo à plataforma para o seu negócio crescer.')).toBeTruthy();
    expect(screen.getByText('29,90')).toBeTruthy();
    expect(screen.getByText('/mês')).toBeTruthy();
    expect(screen.getByText('O que está incluso')).toBeTruthy();
    for (const feature of plan.features) {
      expect(screen.getByText(feature)).toBeTruthy();
    }
  });

  it('shows the cancel-anytime card without an em dash', () => {
    renderOffer();
    expect(screen.getByText('Cancele quando quiser')).toBeTruthy();
    expect(
      screen.getByText('Sem fidelidade, você assina por mês e cancela direto pelo app.'),
    ).toBeTruthy();
  });

  it('subscribes from the CTA and opens the terms', () => {
    const props = renderOffer();
    fireEvent.press(screen.getByText('Assinar por R$ 29,90/mês'));
    expect(props.onSubscribe).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('Termos do plano e política de cobrança'));
    expect(props.onOpenTerms).toHaveBeenCalledTimes(1);
  });

  it('disables the CTA and shows the hint without a saved card', () => {
    const props = renderOffer({ subscribeDisabled: true, noCardHint: 'Nenhum cartão salvo' });
    expect(screen.getByText('Nenhum cartão salvo')).toBeTruthy();
    fireEvent.press(screen.getByText('Assinar por R$ 29,90/mês'));
    expect(props.onSubscribe).not.toHaveBeenCalled();
  });
});

describe('SubscriptionManageView', () => {
  it('composes the status card, payment row and invoice history', () => {
    renderManage();
    expect(screen.getByText('ATIVO')).toBeTruthy();
    expect(screen.getByText('Forma de pagamento')).toBeTruthy();
    expect(screen.getByText('•••• 4242')).toBeTruthy();
    expect(screen.getByText('Histórico de cobranças')).toBeTruthy();
    expect(screen.getByText('14 mai 2026')).toBeTruthy();
  });

  it('changes the card from the payment row', () => {
    const props = renderManage();
    fireEvent.press(screen.getByText('Alterar'));
    expect(props.onChangeCard).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before canceling', () => {
    const props = renderManage();
    fireEvent.press(screen.getByText('Cancelar assinatura'));
    expect(screen.getByText('Cancelar assinatura?')).toBeTruthy();
    expect(screen.getByText('Você mantém o acesso até 14 jun 2026.')).toBeTruthy();

    fireEvent.press(screen.getByText('Voltar'));
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.queryByText('Cancelar assinatura?')).toBeNull();

    fireEvent.press(screen.getByText('Cancelar assinatura'));
    fireEvent.press(screen.getByTestId('confirm-cancel-subscription'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Cancelar assinatura?')).toBeNull();
  });

  it('offers to keep the subscription when the cancellation is scheduled', () => {
    const props = renderManage({ subscription: { ...active, cancelAtPeriodEnd: true } });
    expect(screen.queryByText('Cancelar assinatura')).toBeNull();
    fireEvent.press(screen.getByText('Manter assinatura'));
    expect(props.onResume).toHaveBeenCalledTimes(1);
  });

  it('disables the actions while busy', () => {
    const props = renderManage({ busy: true });
    fireEvent.press(screen.getByText('Alterar'));
    fireEvent.press(screen.getByText('Cancelar assinatura'));
    expect(props.onChangeCard).not.toHaveBeenCalled();
    expect(screen.queryByText('Cancelar assinatura?')).toBeNull();
  });
});
