# TabBar vs Footer: regra de safe area inferior

- Com TabBar visível: a própria TabBar aplica `insets.bottom` (fonte única de verdade). Footer da tela **não** adiciona safe area extra.
- Com TabBar oculta: o footer da tela **deve** aplicar `insets.bottom`, pois não há TabBar protegendo a área inferior.

## Rotas (cliente)
- TabBar visível → `footerSafeArea=false`:
  - `home/index`, `appointments/index`, `profile/index`, `settings/index`
- TabBar oculta → `footerSafeArea=true` (rotas com `tabBarButton: () => null`):
  - `schedule/service`, `schedule/date`, `schedule/time`, `schedule/confirm`
  - `store/[id]`
  - `services/index`
  - `search/index`, `search/results`
  - `profile/edit`, `profile/password`
  - `settings/faq`, `settings/terms`

## Rotas (merchant)
- TabBar visível → `footerSafeArea=false`:
  - `home/index`, `dashboard/index`, `services/index`, `profile/index`, `settings/index`
- TabBar oculta → `footerSafeArea=true` (rotas com `tabBarButton: () => null`):
  - `dashboard/appointment/[id]`, `dashboard/month`
  - `services/create`, `services/edit/[id]`
  - `profile/edit`, `profile/password`
  - `settings/faq`, `settings/terms`
  - `home/share`

## Convenção no ScreenContainer
- Prop `hasTabBar` (default: true).
  - `hasTabBar=true`: footer sem SafeArea (TabBar aplica o insets.bottom).
  - `hasTabBar=false`: footer dentro de `SafeAreaView` (aplica insets.bottom).
- Use `ScreenContainer.footer` para CTAs. Evite `paddingBottom`/`marginBottom` manuais que dupliquem o safe area.

