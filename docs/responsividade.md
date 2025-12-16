# Diretrizes de Responsividade - Wall to All

## Visão Geral

Este documento estabelece as diretrizes e boas práticas para criar layouts responsivos no aplicativo Wall to All. O objetivo é garantir que todas as telas se adaptem adequadamente a diferentes tamanhos de tela, desde smartphones pequenos até tablets.

## Design Base

- **Dispositivo base**: iPhone 12/13/14 (390x844px)
- **Breakpoints**:
  - Small: 375px (iPhone SE, iPhone 8)
  - Medium: 390px (iPhone 12, 13, 14 - design base)
  - Large: 428px (iPhone 14 Pro Max)
  - Tablet: 768px (iPad Mini)
  - Tablet Large: 1024px (iPad Pro)

## Princípios Fundamentais

### 1. Evitar Dimensões Fixas Absolutas

**❌ EVITAR:**
```typescript
width: 256,
height: 88,
width: 342,
```

**✅ PREFERIR:**
```typescript
// Para containers principais
width: '90%',
maxWidth: 342,
alignSelf: 'center'

// Para elementos do design base
const avatarSize = useResponsiveWidth(88);
const cardHeight = useResponsiveHeight(122);
```

### 2. Usar Flexbox Quando Apropriado

Flexbox é ideal para layouts que precisam se adaptar ao espaço disponível:

```typescript
// ✅ BOM - Container que ocupa espaço disponível
container: {
  flex: 1,
  flexDirection: 'row',
  justifyContent: 'space-between',
}

// ✅ BOM - Elemento que cresce para preencher espaço
content: {
  flex: 1,
  padding: 16,
}
```

### 3. Usar Porcentagens para Espaçamento

Porcentagens são ideais para padding e margins horizontais:

```typescript
// ✅ BOM
paddingHorizontal: '5%',
marginHorizontal: '10%',

// ❌ EVITAR (a menos que seja necessário)
paddingHorizontal: 24, // OK se sempre quiser 24px
```

### 4. Usar Hooks Responsivos para Valores do Design Base

Quando você tem um valor específico do design (ex: 88px para avatar, 342px para card), use os hooks responsivos:

```typescript
import { useResponsiveWidth, useResponsiveHeight } from '../../../lib/responsive';

const MyComponent = () => {
  const avatarSize = useResponsiveWidth(88);
  const cardHeight = useResponsiveHeight(122);
  
  return (
    <View style={{ width: avatarSize, height: avatarSize }}>
      {/* ... */}
    </View>
  );
};
```

## Padrões por Tipo de Elemento

### Containers Principais

Para containers de conteúdo principal (formulários, cards, seções):

```typescript
// ✅ PADRÃO RECOMENDADO
container: {
  width: '90%',
  maxWidth: 342,
  alignSelf: 'center',
  padding: 16,
}

// ❌ EVITAR
container: {
  width: 342,
  padding: 16,
}
```

### Botões

Botões devem se adaptar à largura da tela, mas ter um máximo:

```typescript
// ✅ BOM
button: {
  width: '90%',
  maxWidth: 256,
  alignSelf: 'center',
}

// ❌ EVITAR
button: {
  width: 256,
  alignSelf: 'center',
}
```

### Avatares e Imagens de Perfil

Use hooks responsivos para manter proporções:

```typescript
const MyComponent = () => {
  const avatarSize = useResponsiveWidth(88);
  
  return (
    <Image
      source={{ uri: avatarUrl }}
      style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
    />
  );
};
```

### Cards em Grids

Para grids responsivos, use `useCardWidth`:

```typescript
import { useCardWidth } from '../../../lib/responsive';

const MyComponent = () => {
  // 2 colunas com padding 24 e gap 16
  const cardWidth = useCardWidth(2, 24, 16);
  
  return (
    <FlatList
      data={items}
      numColumns={2}
      renderItem={({ item }) => (
        <View style={{ width: cardWidth }}>
          {/* Card content */}
        </View>
      )}
    />
  );
};
```

### Modais

Modais devem ser responsivos mas ter limites máximos:

```typescript
// ✅ BOM
modalContent: {
  width: '90%',
  maxWidth: 400,
  maxHeight: '80%',
  borderRadius: 24,
  padding: 16,
}

// ❌ EVITAR
modalContent: {
  width: 400,
  height: 600,
}
```

### Headers e TopBars

Para elementos de UI que precisam manter altura consistente mas podem escalar:

```typescript
// Para elementos pequenos (ícones, botões pequenos)
// ✅ OK manter fixo
iconButton: {
  width: 24,
  height: 24,
}

// Para elementos maiores que devem escalar
const topBarHeight = useResponsiveHeight(56);
```

## Exceções e Casos Especiais

### Ícones Pequenos

Ícones pequenos (24x24, 32x32) podem manter dimensões fixas, pois são elementos de UI que devem manter proporção visual:

```typescript
// ✅ OK - Ícones pequenos podem ser fixos
icon: {
  width: 24,
  height: 24,
}
```

### Shadow Offsets

Valores de `shadowOffset` podem manter valores fixos pequenos, pois são apenas para efeito visual:

```typescript
// ✅ OK
shadowOffset: { width: 0, height: 4 },
```

### Elementos de Layout Fixo

Alguns elementos podem precisar de dimensões fixas por razões de design específicas. Nestes casos, documente o motivo:

```typescript
// Exemplo: Divider que sempre deve ter 1px
divider: {
  height: 1, // Fixo por design
}
```

## Checklist de Boas Práticas

Use este checklist ao criar ou revisar componentes:

### Dimensões
- [ ] Evitei usar `width: 256`, `width: 342` ou outros valores fixos absolutos?
- [ ] Usei `width: '90%', maxWidth: X` para containers principais?
- [ ] Usei `flex: 1` quando apropriado para elementos que devem preencher espaço?
- [ ] Usei `useResponsiveWidth()` e `useResponsiveHeight()` para valores do design base?
- [ ] Usei `useCardWidth()` para grids responsivos?

### Espaçamento
- [ ] Usei porcentagens para padding/margin horizontal quando possível?
- [ ] Mantive padding consistente usando valores relativos?

### Componentes
- [ ] Botões usam `width: '90%', maxWidth: X`?
- [ ] Modais são responsivos com `maxWidth` e `maxHeight`?
- [ ] Cards e containers principais seguem o padrão `width: '90%', maxWidth: 342`?

### Testes
- [ ] Testei em iPhone SE (375px)?
- [ ] Testei em iPhone 12/13/14 (390px - design base)?
- [ ] Testei em iPhone 14 Pro Max (428px)?
- [ ] Testei em tablets (768px+) se aplicável?

## Utilitários Disponíveis

O projeto possui utilitários em `lib/responsive.ts`:

### Hooks Reativos (atualizam em rotação de tela)
- `useResponsiveDimensions()` - Retorna `{ width, height }` atualizados
- `useResponsiveWidth(baseWidth)` - Largura escalada reativa
- `useResponsiveHeight(baseHeight)` - Altura escalada reativa
- `useCardWidth(columns, padding, gap)` - Largura de card em grid

### Funções Não-Reativas (valores estáticos)
- `responsiveWidth(baseWidth)` - Largura escalada (não reativa)
- `responsiveHeight(baseHeight)` - Altura escalada (não reativa)
- `calculateCardWidth(columns, padding, gap)` - Largura de card (não reativa)
- `isTablet()` - Verifica se é tablet
- `isSmallScreen()` - Verifica se é tela pequena
- `isLargeScreen()` - Verifica se é tela grande
- `clamp(value, min, max)` - Limita valor entre min e max

### Breakpoints
```typescript
import { BREAKPOINTS } from '../../../lib/responsive';

// BREAKPOINTS.small = 375
// BREAKPOINTS.medium = 390
// BREAKPOINTS.large = 428
// BREAKPOINTS.tablet = 768
// BREAKPOINTS.tabletLarge = 1024
```

## Exemplos Práticos

### Exemplo 1: Card de Perfil

```typescript
import { useResponsiveWidth } from '../../../lib/responsive';

const ProfileCard = () => {
  const avatarSize = useResponsiveWidth(88);
  
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.avatar, { width: avatarSize, height: avatarSize }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '90%',
    maxWidth: 342,
    alignSelf: 'center',
    padding: 16,
  },
  avatar: {
    borderRadius: 44, // Metade do tamanho base (88/2)
  },
});
```

### Exemplo 2: Grid de Cards

```typescript
import { useCardWidth } from '../../../lib/responsive';

const ServicesGrid = () => {
  const cardWidth = useCardWidth(2, 24, 16); // 2 colunas
  
  return (
    <FlatList
      data={services}
      numColumns={2}
      renderItem={({ item }) => (
        <View style={[styles.card, { width: cardWidth }]}>
          {/* Card content */}
        </View>
      )}
    />
  );
};
```

### Exemplo 3: Botão Responsivo

```typescript
const ActionButton = () => {
  return (
    <CustomButton
      title="Continuar"
      style={styles.button}
      width="100%"
    />
  );
};

const styles = StyleSheet.create({
  button: {
    width: '90%',
    maxWidth: 256,
    alignSelf: 'center',
  },
});
```

## Validação e Testes

Sempre valide seus layouts em diferentes tamanhos de tela:

1. **iPhone SE (375px)** - Tela pequena
2. **iPhone 12/13/14 (390px)** - Design base
3. **iPhone 14 Pro Max (428px)** - Tela grande
4. **Tablets (768px+)** - Se aplicável ao seu componente

Use simuladores e dispositivos físicos quando possível para garantir a melhor experiência do usuário.

## Referências

- [React Native Layout Documentation](https://reactnative.dev/docs/flexbox)
- [useWindowDimensions Hook](https://reactnative.dev/docs/usewindowdimensions)
- Arquivo de utilitários: `lib/responsive.ts`
