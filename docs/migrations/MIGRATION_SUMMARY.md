# Migração de Ícones SVG para @expo/vector-icons

## Resumo das Mudanças

### ✅ Ícones Substituídos por MaterialIcons

Os seguintes ícones foram substituídos por `@expo/vector-icons` (MaterialIcons) e agora estão em `lib/icons.tsx`:

1. `IconAccountCircle` → `MaterialIcons` → `"account-circle"`
2. `IconVisibilityOff` → `MaterialIcons` → `"visibility-off"`
3. `IconCheckbox` → `MaterialIcons` → `"check-box"`
4. `IconCheckboxOutline` → `MaterialIcons` → `"check-box-outline-blank"`
5. `IconCreditCard` → `MaterialIcons` → `"credit-card"`
6. `IconCash` → `MaterialIcons` → `"attach-money"`
7. `IconChevronDown` → `MaterialIcons` → `"keyboard-arrow-down"`
8. `IconAddPhoto` → `MaterialIcons` → `"add-photo-alternate"`
9. `IconClose` → `MaterialIcons` → `"close"`
10. `IconSearch` → `MaterialIcons` → `"search"`
11. `IconNotification` → `MaterialIcons` → `"notifications"`
12. `IconRatingStar` → `MaterialIcons` → `"star"`
13. `IconSchedule` → `MaterialIcons` → `"calendar-today"`
14. `IconProfile` → `MaterialIcons` → `"person"`
15. `IconSettings` → `MaterialIcons` → `"settings"`

### ✅ Ícones Mantidos (Customizados/Únicos)

Os seguintes ícones permanecem na pasta `assets` e são exportados de `lib/assets.ts`:

1. `LogoWallToAll` (bricks.svg) - Logo customizado do Wall to All
2. `LogoWallToAllTypography` (typography.svg) - Tipografia customizada
3. `GoogleLogo` (Google Logo.svg) - Logo oficial do Google
4. `IconPix` (Pix Icon.svg) - Ícone específico do Brasil (PIX)
5. `IconHandshake` (handshake.svg) - Ícone de categoria customizada
6. `IconHandyman` (handyman.svg) - Ícone de categoria customizada
7. `IconCheckboxPayment` (checkboxpayment.svg) - Checkbox customizado para pagamentos

### 📁 Arquivos Atualizados

1. `lib/icons.tsx` - **NOVO**: Helper para ícones MaterialIcons
2. `lib/assets.ts` - Atualizado para manter apenas ícones customizados
3. `app/(auth)/login.tsx` - Atualizado para usar MaterialIcons
4. `app/(auth)/merchant-signup-business.tsx` - Atualizado para usar MaterialIcons
5. `app/(auth)/merchant-signup-services.tsx` - Atualizado para usar MaterialIcons
6. `app/(client)/home/index.tsx` - Atualizado para usar MaterialIcons

### ✅ SVGs Removidos

Os seguintes arquivos SVG foram **removidos** da pasta `assets` pois foram substituídos por MaterialIcons:

- ✅ `account_circle.svg` - Removido
- ✅ `visibility_off.svg` - Removido
- ✅ `Checkbox.svg` - Removido
- ✅ `check_box_outline_blank-icon.svg` - Removido
- ✅ `Credit Card Icon.svg` - Removido
- ✅ `Cash Icon.svg` - Removido
- ✅ `keyboard_arrow_down.svg` - Removido
- ✅ `addphoto.svg` - Removido
- ✅ `close-icon.svg` - Removido
- ✅ `search-icon.svg` - Removido
- ✅ `Notification Icon.svg` - Removido
- ✅ `Rating Star.svg` - Removido
- ✅ `schedule.svg` - Removido
- ✅ `profile-icon.svg` - Removido
- ✅ `settings.svg` - Removido

**Total**: 15 arquivos SVG removidos com sucesso! 🎉

### 📝 Como Usar os Novos Ícones

Os ícones MaterialIcons mantêm a mesma interface dos SVGs anteriores:

```tsx
// Antes (SVG)
import { IconSearch } from '../../lib/assets';
<IconSearch width={24} height={24} />

// Agora (MaterialIcons)
import { IconSearch } from '../../lib/icons';
<IconSearch width={24} height={24} />
// ou
<IconSearch size={24} />
```

### ✅ Benefícios

1. **Redução de tamanho**: Menos arquivos SVG na pasta assets
2. **Manutenção**: Ícones padronizados e atualizados automaticamente
3. **Performance**: Ícones vetoriais nativos do Material Design
4. **Consistência**: Todos os ícones comuns seguem o mesmo design system

