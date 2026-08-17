import type { DrawerItem } from './AppDrawer';

/**
 * Itens do menu (drawer) do LOJISTA, na ordem em que o AppDrawer os renderiza.
 *
 * Fonte ÚNICA das listas do lojista, em DUAS constantes montadas dos mesmos
 * pedaços nomeados abaixo:
 * - MERCHANT_DRAWER_ITEMS: lista comum às telas que abrem o drawer (aqui-agora,
 *   financeiro e QI). Mesma lição do clientDrawerItems: a lista já esteve
 *   copiada nas telas, e acrescentar um item exigia editar todas (foi o que
 *   aconteceria de novo ao entrar o "QI"). "QI" fica depois de "Financeiro",
 *   espelhando o cliente, que o pôs depois de "Carteira".
 * - MERCHANT_HOME_DRAWER_ITEMS: variante da HOME, que acrescenta "Compartilhar
 *   perfil" logo após o "QI" (a seção que saiu da home migrou para o drawer;
 *   só a home tem esse item). Composta AQUI por construção (spread dos
 *   pedaços), sem busca por rótulo: o ponto de inserção não depende de copy de
 *   exibição nem tem modo de falha silencioso.
 *
 * Constantes de módulo: a referência é estável entre renders, então as telas
 * passam direto na prop `items`, sem `useMemo`.
 */

// Pedaços nomeados: o item extra da home entra ENTRE os dois na variante dela.
const ITEMS_UP_TO_QI: DrawerItem[] = [
  { label: 'Início', route: '/(merchant)/home' },
  { label: 'Agenda', route: '/(merchant)/dashboard' },
  { label: 'Serviços', route: '/(merchant)/services' },
  { label: 'Financeiro', route: '/(merchant)/financeiro' },
  { label: 'QI', route: '/(merchant)/qi' },
];
const ITEMS_AFTER_QI: DrawerItem[] = [
  { label: 'Perfil', route: '/(merchant)/profile' },
  { label: 'Configurações', route: '/(merchant)/settings' },
];

export const MERCHANT_DRAWER_ITEMS: DrawerItem[] = [...ITEMS_UP_TO_QI, ...ITEMS_AFTER_QI];

export const MERCHANT_HOME_DRAWER_ITEMS: DrawerItem[] = [
  ...ITEMS_UP_TO_QI,
  { label: 'Compartilhar perfil', route: '/(merchant)/home/share' },
  ...ITEMS_AFTER_QI,
];
