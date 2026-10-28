import type { DrawerItem } from './AppDrawer';

/**
 * Itens do menu (drawer) do CLIENTE, na ordem em que o AppDrawer os renderiza.
 *
 * Fonte ÚNICA das telas do cliente que abrem o drawer (home, carteira e QI).
 * A lista já esteve copiada nas três, e acrescentar um item exigia editar os
 * três arquivos (foi o que aconteceu ao entrar o "QI").
 *
 * Constante de módulo: a referência é estável entre renders, então as telas
 * passam direto na prop `items`, sem `useMemo`.
 */
export const CLIENT_DRAWER_ITEMS: DrawerItem[] = [
  { label: 'Início', route: '/(client)/home' },
  { label: 'Meus agendamentos', route: '/(client)/appointments' },
  { label: 'Buscar serviços', route: '/(client)/search' },
  { label: 'Carteira', route: '/(client)/wallet' },
  { label: 'QI', route: '/(client)/qi' },
  { label: 'Perfil', route: '/(client)/profile' },
  { label: 'Configurações', route: '/(client)/settings' },
];
