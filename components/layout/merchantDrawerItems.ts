import type { DrawerItem } from './AppDrawer';

/**
 * Itens do menu (drawer) do LOJISTA, na ordem em que o AppDrawer os renderiza.
 *
 * Fonte ÚNICA da lista comum às telas do lojista que abrem o drawer
 * (aqui-agora, financeiro e QI). Mesma lição do clientDrawerItems: a lista já
 * esteve copiada nas telas, e acrescentar um item exigia editar todas (foi o
 * que aconteceria de novo ao entrar o "QI"). "QI" fica depois de "Financeiro",
 * espelhando o cliente, que o pôs depois de "Carteira".
 *
 * A home do lojista DIFERE (tem o item extra "Compartilhar perfil"), então ela
 * compõe a própria lista a partir desta constante em vez de usá-la direto.
 *
 * Constante de módulo: a referência é estável entre renders, então as telas
 * passam direto na prop `items`, sem `useMemo`.
 */
export const MERCHANT_DRAWER_ITEMS: DrawerItem[] = [
  { label: 'Início', route: '/(merchant)/home' },
  { label: 'Agenda', route: '/(merchant)/dashboard' },
  { label: 'Serviços', route: '/(merchant)/services' },
  { label: 'Financeiro', route: '/(merchant)/financeiro' },
  { label: 'QI', route: '/(merchant)/qi' },
  { label: 'Perfil', route: '/(merchant)/profile' },
  { label: 'Configurações', route: '/(merchant)/settings' },
];
