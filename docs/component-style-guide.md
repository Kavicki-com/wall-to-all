# Guia de Estilo de Componentes

Este documento descreve os componentes reutilizáveis disponíveis no projeto e como utilizá-los.

## Componentes Disponíveis

### CustomButton

Componente de botão padronizado com múltiplas variantes.

**Localização:** `components/CustomButton.tsx`

**Props:**
- `title: string` - Texto do botão (obrigatório)
- `onPress: () => void` - Função chamada ao pressionar (obrigatório)
- `variant?: 'primary' | 'outline' | 'outline-white' | 'red' | 'ghost' | 'danger'` - Variante do botão (padrão: 'primary')
- `isLoading?: boolean` - Mostra indicador de loading (padrão: false)
- `disabled?: boolean` - Desabilita o botão (padrão: false)
- `width?: DimensionValue` - Largura do botão (padrão: '100%')
- `rightIcon?: React.ReactNode` - Ícone à direita do texto
- `style?: ViewStyle` - Estilos customizados

**Variantes:**
- `primary` - Botão preenchido azul (#000E3D)
- `outline` - Botão com borda azul, fundo transparente
- `outline-white` - Botão com borda branca, fundo transparente
- `red` - Botão preenchido vermelho (#D32F2F)
- `ghost` - Botão transparente sem borda, texto azul
- `danger` - Botão transparente sem borda, texto vermelho (#E5102E)

**Exemplo:**
```tsx
<CustomButton
  title="Salvar"
  variant="primary"
  onPress={handleSave}
  isLoading={saving}
  width="100%"
/>
```

---

### CustomInput

Componente de input padronizado com suporte a label, erro, senha, ícones e modo read-only.

**Localização:** `components/ui/CustomInput.tsx`

**Props:**
- `label?: string` - Label do campo
- `error?: string` - Mensagem de erro
- `isPassword?: boolean` - Ativa toggle de visibilidade de senha
- `readOnly?: boolean` - Campo somente leitura
- `leftIcon?: React.ReactNode` - Ícone à esquerda
- `rightIcon?: React.ReactNode` - Ícone à direita (quando não é senha)
- `helperText?: string` - Texto de ajuda
- `containerStyle?: ViewStyle` - Estilos do container
- Todas as props do `TextInput` do React Native

**Exemplo:**
```tsx
<CustomInput
  label="Email"
  placeholder="seu@email.com"
  value={email}
  onChangeText={setEmail}
  keyboardType="email-address"
  autoCapitalize="none"
  rightIcon={<IconAccountCircle width={20} height={20} />}
/>

<CustomInput
  label="Senha"
  isPassword
  value={password}
  onChangeText={setPassword}
/>

<CustomInput
  label="Nome"
  value={name}
  readOnly
/>
```

---

### ScreenContainer

Container padronizado para telas com SafeArea, scroll e padding consistente.

**Localização:** `components/layout/ScreenContainer.tsx`

**Props:**
- `children: React.ReactNode` - Conteúdo da tela
- `scroll?: boolean` - Habilita scroll (padrão: false)
- `withSafeArea?: boolean` - Usa SafeAreaView (padrão: true)
- `backgroundColor?: string` - Cor de fundo customizada
- `horizontalPadding?: number` - Padding horizontal (padrão: undefined)
- `contentContainerStyle?: ViewStyle` - Estilos do contentContainer quando usando scroll

**Exemplo:**
```tsx
<ScreenContainer scroll backgroundColor="#FAFAFA" horizontalPadding={24}>
  {/* Conteúdo da tela */}
</ScreenContainer>
```

---

### Card

Componente de card reutilizável com variantes.

**Localização:** `components/ui/Card.tsx`

**Props:**
- `children: React.ReactNode` - Conteúdo do card
- `variant?: 'primary' | 'secondary'` - Variante do card (padrão: 'secondary')
- `padding?: number` - Padding uniforme
- `paddingHorizontal?: number` - Padding horizontal
- `paddingVertical?: number` - Padding vertical
- `style?: ViewStyle` - Estilos customizados

**Variantes:**
- `primary` - Border radius 24, sombra maior (shadowOpacity: 0.16, shadowRadius: 16)
- `secondary` - Border radius 4, sombra menor (shadowOpacity: 0.08, shadowRadius: 8)

**Exemplo:**
```tsx
<Card variant="secondary" padding={16}>
  <Text>Conteúdo do card</Text>
</Card>
```

---

### Chip

Componente de chip/tag para seleção ou exibição.

**Localização:** `components/ui/Chip.tsx`

**Props:**
- `label: string` - Texto do chip (obrigatório)
- `selected?: boolean` - Estado selecionado
- `onPress?: () => void` - Função chamada ao pressionar
- `onClose?: () => void` - Função chamada ao fechar (mostra ícone X)
- `variant?: 'outline' | 'filled'` - Variante do chip (padrão: 'outline')
- `disabled?: boolean` - Desabilita o chip
- `style?: ViewStyle` - Estilos customizados
- `textStyle?: TextStyle` - Estilos do texto

**Exemplo:**
```tsx
<Chip
  label="Categoria"
  variant="outline"
  selected={selected}
  onPress={() => setSelected(!selected)}
/>

<Chip
  label="Selecionado"
  variant="filled"
  selected={true}
  onClose={() => handleRemove()}
/>
```

---

### RadioButton e RadioGroup

Componentes para seleção única.

**Localização:** 
- `components/ui/RadioButton.tsx`
- `components/ui/RadioGroup.tsx`

**RadioButton Props:**
- `label: string` - Texto do radio button
- `selected: boolean` - Estado selecionado (obrigatório)
- `onPress: () => void` - Função chamada ao pressionar (obrigatório)
- `disabled?: boolean` - Desabilita o radio button
- `value?: string | number` - Valor do radio button

**RadioGroup Props:**
- `options: RadioGroupOption[]` - Array de opções
- `value: string | number | null` - Valor selecionado
- `onValueChange: (value: string | number) => void` - Função chamada ao mudar valor
- `direction?: 'row' | 'column'` - Direção do layout (padrão: 'row')
- `gap?: number` - Espaçamento entre opções (padrão: 12)

**RadioGroupOption:**
```tsx
{
  label: string;
  value: string | number;
  disabled?: boolean;
}
```

**Exemplo:**
```tsx
<RadioGroup
  options={[
    { label: 'Valor Fixo', value: 'fixed' },
    { label: 'Valor por hora', value: 'hourly' },
  ]}
  value={chargeType}
  onValueChange={(value) => setChargeType(value as 'fixed' | 'hourly')}
  direction="row"
/>
```

---

## Padrões de Uso

### Quando usar CustomButton

✅ **Use CustomButton para:**
- Ações principais (salvar, continuar, confirmar)
- Ações secundárias (cancelar, voltar)
- Botões de formulário
- Botões de navegação

❌ **Não use CustomButton para:**
- Links de texto (use TextLink quando criado)
- Ícones clicáveis sem texto (use TouchableOpacity ou IconButton quando criado)
- Itens de lista clicáveis (pode usar TouchableOpacity diretamente ou ListItem quando criado)

### Quando usar CustomInput

✅ **Use CustomInput para:**
- Todos os campos de formulário
- Campos de senha
- Campos com validação
- Campos read-only

❌ **Não use TextInput diretamente:**
- Sempre prefira CustomInput para consistência

### Quando usar Card

✅ **Use Card para:**
- Containers de conteúdo com sombra
- Cards de informação
- Cards de lista

**Escolha da variante:**
- `primary` (radius 24) - Cards principais, destacados
- `secondary` (radius 4) - Cards secundários, listas, informações

### Quando usar Chip

✅ **Use Chip para:**
- Tags de categoria
- Seletores múltiplos
- Filtros
- Etiquetas removíveis

### Quando usar RadioGroup

✅ **Use RadioGroup para:**
- Seleção única em formulários
- Opções mutuamente exclusivas
- Preferências do usuário

---

## Boas Práticas

1. **Sempre use componentes reutilizáveis** ao invés de criar estilos manuais
2. **Mantenha consistência visual** usando as variantes corretas
3. **Use props de estilo apenas quando necessário** - os componentes já têm estilos padrão
4. **Documente exceções** - se precisar de um componente customizado, documente o porquê
5. **Teste visualmente** após refatorações para garantir que o visual foi mantido

---

## Checklist de Refatoração

Ao refatorar uma tela:

- [ ] Substituir `TouchableOpacity` com estilo de botão por `CustomButton`
- [ ] Substituir `TextInput` por `CustomInput`
- [ ] Substituir cards manuais por `Card`
- [ ] Substituir radio buttons manuais por `RadioGroup`
- [ ] Substituir chips manuais por `Chip`
- [ ] Verificar uso de `ScreenContainer` para layout consistente
- [ ] Remover estilos não utilizados após refatoração
- [ ] Testar visualmente para garantir que nada quebrou

---

## Status da Refatoração

### ✅ Componentes Criados
- CustomButton (com variantes ghost e danger)
- CustomInput (com readOnly)
- ScreenContainer
- Card (primary e secondary)
- Chip
- RadioButton e RadioGroup

### ✅ Telas Refatoradas (Alta Prioridade)
- `app/(client)/home/index.tsx`
- `app/(client)/profile/edit.tsx`
- `app/(client)/store/[id].tsx`
- `app/(merchant)/home/index.tsx`
- `app/(merchant)/services/create.tsx`
- `app/(merchant)/services/edit/[id].tsx`
- `app/(merchant)/profile/edit.tsx`
- `app/(merchant)/settings/index.tsx`

### ⏳ Telas Pendentes
- Telas de autenticação (login, signup, etc)
- Telas de agendamento (appointments)
- Telas de configurações secundárias (FAQ, Terms)
- Outras telas de média/baixa prioridade

---

**Última atualização:** 2024
