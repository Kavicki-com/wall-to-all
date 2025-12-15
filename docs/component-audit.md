# Auditoria de Componentes Reutilizáveis

**Data:** 2024  
**Objetivo:** Verificar se as telas do app usam componentes reutilizáveis ao invés de layout montado na mão  
**Status:** Em progresso - Refatoração iniciada em 2024

---

## Resumo Executivo

Este relatório analisa todas as telas dentro da pasta `app` e componentes reutilizáveis dentro da pasta `components` para identificar oportunidades de padronização e reutilização de componentes.

**Componentes Reutilizáveis Existentes:**
- `CustomButton` - Botão com variantes (primary, outline, outline-white, red, **ghost**, **danger**) ✅
- `CustomInput` - Input com label, erro, senha, ícones, **readOnly** ✅
- `ScreenContainer` - Container com SafeArea, scroll, padding ✅
- `Card` - Card reutilizável com variantes (primary, secondary) ✅ **NOVO**
- `Chip` - Componente de chip/tag com seleção ✅ **NOVO**
- `RadioButton` / `RadioGroup` - Seleção única ✅ **NOVO**
- `AppHeader` - Cabeçalho com back button, título, notificações
- `BusinessCard`, `ServiceCard`, `AppointmentCard` - Cards específicos

**Ver:** [Guia de Estilo de Componentes](./component-style-guide.md) para documentação completa

---

## Tabela de Problemas Encontrados

| Caminho do Arquivo | Tipo de Problema | Trecho de Exemplo | Recomendação | Prioridade |
|-------------------|------------------|-------------------|--------------|------------|
| `app/(auth)/login.tsx` | Botão de ação | `<TouchableOpacity style={styles.buttonGoogle}>` | Criar `CustomButton` variant="google" ou usar `CustomButton` com ícone | Alta |
| `app/(auth)/login.tsx` | Link de texto | `<TouchableOpacity onPress={handleForgotPasswordPress}>` | Criar componente `TextLink` ou `LinkButton` | Média |
| `app/(auth)/login.tsx` | Container manual | `View` com `LinearGradient` e posicionamento absoluto | Usar `ScreenContainer` com background customizado | Baixa |
| `app/(client)/home/index.tsx` | Botão de ação | `<TouchableOpacity style={styles.scheduleButton}>` (linha 565) | Usar `CustomButton` variant="outline" | Alta |
| `app/(client)/home/index.tsx` | Chip de categoria | `<TouchableOpacity style={styles.categoryChip}>` (linha 458) | Criar componente `CategoryChip` ou `Tag` | Média |
| `app/(client)/profile/edit.tsx` | Botão ghost | `<TouchableOpacity style={styles.ghostButton}>` (linha 367) | Usar `CustomButton` variant="outline" ou criar variant="ghost" | Alta |
| `app/(client)/profile/edit.tsx` | Botão de exclusão | `<TouchableOpacity style={styles.deleteButton}>` (linha 376) | Usar `CustomButton` variant="red" ou criar variant="danger" | Alta |
| `app/(client)/profile/edit.tsx` | Input read-only | `View` com `Text` simulando input (linha 340-345) | Criar `CustomInput` com prop `readOnly` ou `CustomDisplayField` | Média |
| `app/(client)/schedule/confirm.tsx` | TextInput multiline | `<TextInput style={styles.observationsInput}>` (linha 347) | Usar `CustomInput` com `multiline` | Alta |
| `app/(client)/schedule/confirm.tsx` | Card principal | `View` com `borderRadius: 24`, `shadowColor`, etc (linha 415) | Criar componente `Card` reutilizável | Alta |
| `app/(client)/schedule/confirm.tsx` | Radio button custom | `TouchableOpacity` com círculo custom (linha 291-340) | Criar componente `RadioButton` ou `RadioGroup` | Média |
| `app/(client)/store/[id].tsx` | Botão de ação | `<TouchableOpacity style={styles.scheduleButton}>` (linha 378) | Usar `CustomButton` variant="primary" | Alta |
| `app/(client)/store/[id].tsx` | Botão outline | `<TouchableOpacity style={styles.reviewButton}>` (linha 391) | Usar `CustomButton` variant="outline" | Alta |
| `app/(client)/store/[id].tsx` | Cards repetidos | Múltiplos `View` com `borderRadius: 4`, `shadowColor`, etc (linhas 526-633) | Criar componente `Card` reutilizável | Alta |
| `app/(client)/store/[id].tsx` | TopBar manual | `View` com gradiente e botões (linha 236-250) | Usar `AppHeader` ou criar `StoreHeader` | Média |
| `app/(merchant)/services/create.tsx` | Botão de ação | `<TouchableOpacity style={styles.buttonContained}>` (linha 519) | Usar `CustomButton` variant="primary" | Alta |
| `app/(merchant)/services/create.tsx` | Radio button custom | `TouchableOpacity` com círculo custom (linha 369-389) | Criar componente `RadioButton` ou `RadioGroup` | Média |
| `app/(merchant)/services/create.tsx` | Chip custom | `TouchableOpacity` com estilo de chip (linha 416-476) | Criar componente `Chip` ou `Tag` reutilizável | Média |
| `app/(merchant)/services/create.tsx` | Textarea | `CustomInput` com `multiline` mas estilo customizado | Verificar se `CustomInput` suporta textarea adequadamente | Baixa |
| `app/(auth)/user-type-selection.tsx` | Card selecionável | `TouchableOpacity` com `borderRadius: 24`, shadow (linha 74-140) | Criar componente `SelectableCard` | Média |
| `app/(auth)/user-type-selection.tsx` | Botão já usa CustomButton | ✅ Usa `CustomButton` corretamente | - | - |
| `app/(client)/search/results.tsx` | Botão já usa CustomButton | ✅ Usa `CustomButton` corretamente | - | - |
| `app/(client)/appointments/[id].tsx` | Card principal | `View` com `borderRadius: 24`, `shadowColor`, etc | Criar componente `Card` reutilizável | Alta |
| `app/(client)/appointments/[id].tsx` | Botões de ação | Múltiplos `TouchableOpacity` com estilos de botão | Usar `CustomButton` | Alta |

---

## Análise Detalhada por Categoria

### 1. Botões de Ação

#### Problemas Identificados:

**Alta Prioridade:**
- `app/(client)/home/index.tsx` - Botão "Agendar serviços" (linha 565) - `TouchableOpacity` com estilo de botão outline
- `app/(client)/profile/edit.tsx` - Botão "Alterar senha" (linha 367) - `TouchableOpacity` com estilo ghost
- `app/(client)/profile/edit.tsx` - Botão "Excluir conta" (linha 376) - `TouchableOpacity` com estilo de botão vermelho
- `app/(client)/store/[id].tsx` - Botão "Agendar serviços" (linha 378) - `TouchableOpacity` com estilo primary
- `app/(client)/store/[id].tsx` - Botão "Avaliar" (linha 391) - `TouchableOpacity` com estilo outline
- `app/(merchant)/services/create.tsx` - Botão "Continuar" (linha 519) - `TouchableOpacity` com estilo primary

**Média Prioridade:**
- `app/(auth)/login.tsx` - Botão Google (linha 240) - `TouchableOpacity` customizado com ícone

**Recomendações:**
1. Substituir todos os `TouchableOpacity` com estilo de botão por `CustomButton`
2. Adicionar variantes ao `CustomButton` se necessário: `ghost`, `danger`, `google`
3. Criar componente `IconButton` para botões com ícone

---

### 2. Inputs

#### Problemas Identificados:

**Alta Prioridade:**
- `app/(client)/schedule/confirm.tsx` - `TextInput` multiline para observações (linha 347) - Deveria usar `CustomInput`

**Média Prioridade:**
- `app/(client)/profile/edit.tsx` - Campos read-only simulados com `View` e `Text` (linhas 340-360) - Criar `CustomDisplayField` ou adicionar prop `readOnly` ao `CustomInput`

**Observações:**
- A maioria das telas já usa `CustomInput` corretamente
- `CustomInput` já suporta `multiline`, mas alguns casos usam `TextInput` direto

**Recomendações:**
1. Substituir `TextInput` direto por `CustomInput` quando aplicável
2. Adicionar prop `readOnly` ao `CustomInput` ou criar `CustomDisplayField`
3. Verificar se `CustomInput` com `multiline` está funcionando corretamente em todos os casos

---

### 3. Cabeçalho e Container

#### Problemas Identificados:

**Média Prioridade:**
- `app/(client)/store/[id].tsx` - TopBar manual com gradiente (linha 236-250) - Deveria usar `AppHeader` ou criar variante específica
- `app/(auth)/login.tsx` - Container com posicionamento absoluto - Layout especial, pode manter mas documentar

**Observações:**
- A maioria das telas já usa `ScreenContainer` e `AppHeader` corretamente
- Algumas telas de autenticação têm layouts especiais que podem justificar exceções

**Recomendações:**
1. Padronizar uso de `AppHeader` em todas as telas que precisam de cabeçalho
2. Criar variantes do `AppHeader` se necessário (ex: `StoreHeader`)
3. Documentar exceções para layouts especiais

---

### 4. Cards

#### Problemas Identificados:

**Alta Prioridade:**
- `app/(client)/schedule/confirm.tsx` - Card principal com `borderRadius: 24`, shadow (linha 415) - Padrão repetido
- `app/(client)/appointments/[id].tsx` - Card principal com mesmo padrão
- `app/(client)/store/[id].tsx` - Múltiplos cards com `borderRadius: 4`, shadow (linhas 526-633)
- `app/(auth)/user-type-selection.tsx` - Cards selecionáveis com `borderRadius: 24`, shadow (linha 196)

**Padrões Identificados:**
1. **Card Principal (radius 24):**
   - `backgroundColor: '#FEFEFE'`
   - `borderRadius: 24` ou `borderBottomLeftRadius: 24`
   - `shadowColor: '#1D1D1D'`
   - `shadowOffset: { width: 0, height: 4 }`
   - `shadowOpacity: 0.16`
   - `shadowRadius: 16`
   - `elevation: 4`

2. **Card Secundário (radius 4):**
   - `backgroundColor: '#FEFEFE'`
   - `borderRadius: 4`
   - `shadowColor: '#1D1D1D'`
   - `shadowOffset: { width: 0, height: 2 }` ou `{ width: 0, height: 4 }`
   - `shadowOpacity: 0.08`
   - `shadowRadius: 8`
   - `elevation: 2` ou `4`

**Recomendações:**
1. Criar componente `Card` reutilizável com variantes:
   - `variant="primary"` - radius 24, shadow maior
   - `variant="secondary"` - radius 4, shadow menor
   - `variant="selectable"` - radius 24, com estados selected/unselected
2. Criar componente `SelectableCard` para casos de seleção
3. Substituir todos os cards manuais pelo componente reutilizável

---

### 5. Componentes de Seleção

#### Problemas Identificados:

**Média Prioridade:**
- `app/(client)/schedule/confirm.tsx` - Radio buttons custom (linha 291-340) - Padrão repetido
- `app/(merchant)/services/create.tsx` - Radio buttons custom (linha 369-389)
- `app/(merchant)/services/create.tsx` - Chips custom (linha 416-476)
- `app/(client)/home/index.tsx` - Chips de categoria (linha 458)

**Recomendações:**
1. Criar componente `RadioButton` e `RadioGroup`
2. Criar componente `Chip` ou `Tag` reutilizável
3. Criar componente `CategoryChip` se necessário

---

## Estatísticas

- **Total de telas analisadas:** ~40
- **Telas usando CustomButton corretamente:** ~75% ✅ (aumentou)
- **Telas usando CustomInput corretamente:** ~90% ✅ (aumentou)
- **Telas usando ScreenContainer corretamente:** ~90%
- **Telas usando AppHeader corretamente:** ~80%
- **Telas com cards manuais:** ~10 ✅ (reduziu)
- **Telas com botões manuais:** ~5 ✅ (reduziu)
- **Telas com inputs manuais:** ~1 ✅ (reduziu)

**Progresso da Refatoração:**
- ✅ 8 telas de alta prioridade refatoradas
- ⏳ Telas de média/baixa prioridade pendentes

---

## Componentes a Criar

### Prioridade Alta
1. **`Card`** - Componente de card reutilizável com variantes
2. **`RadioButton` / `RadioGroup`** - Componente de seleção única
3. **Variantes adicionais do `CustomButton`** - ghost, danger, google

### Prioridade Média
4. **`Chip` / `Tag`** - Componente de tag/chip reutilizável
5. **`SelectableCard`** - Card com estado selecionável
6. **`TextLink` / `LinkButton`** - Link de texto clicável
7. **`CustomDisplayField`** - Campo de exibição read-only

### Prioridade Baixa
8. **`IconButton`** - Botão com ícone
9. **Variantes do `AppHeader`** - Se necessário para casos específicos

---

## Próximos Passos Recomendados

1. **Criar componente `Card`** - Maior impacto, usado em múltiplas telas
2. **Padronizar botões** - Substituir `TouchableOpacity` por `CustomButton`
3. **Criar `RadioButton` e `RadioGroup`** - Reduzir duplicação de código
4. **Substituir `TextInput` direto** - Usar `CustomInput` consistentemente
5. **Criar componentes de chip/tag** - Padronizar elementos de seleção

---

## Notas Finais

- O projeto já tem uma boa base de componentes reutilizáveis
- A maioria das telas já usa `ScreenContainer` e `AppHeader` corretamente
- Os principais problemas são:
  1. Cards repetidos manualmente
  2. Botões de ação usando `TouchableOpacity` ao invés de `CustomButton`
  3. Falta de componentes para seleção (radio, chip)
- Com as refatorações sugeridas, o app terá consistência visual e de código muito melhor


