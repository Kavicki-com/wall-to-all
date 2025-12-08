# SelectDropdown - Componente de Dropdown Genérico

Componente genérico e reutilizável para criar dropdowns de seleção no app Wall to All.

## 🎯 Características

- ✅ **Genérico**: Usa TypeScript Generics para aceitar qualquer tipo de dados
- ✅ **Flexível**: Funciona com dados locais ou da API (Supabase)
- ✅ **Customizável**: Aceita estilos customizados e ícones do projeto
- ✅ **Acessível**: Segue os padrões de acessibilidade do React Native
- ✅ **Consistente**: Mantém o mesmo design system do app

## 📦 Importação

```tsx
import SelectDropdown from '../../components/ui/SelectDropdown';
```

## 🔧 Props

| Prop | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `data` | `T[]` | ✅ | Array de dados para exibir |
| `labelKey` | `keyof T \| (item: T) => string` | ✅ | Chave ou função para extrair o texto a exibir |
| `valueKey` | `keyof T \| (item: T) => any` | ✅ | Chave ou função para extrair o valor único |
| `onSelect` | `(item: T) => void` | ✅ | Callback quando um item é selecionado |
| `placeholder` | `string` | ❌ | Texto padrão (default: "Selecione aqui") |
| `selectedValue` | `T \| null` | ❌ | Item selecionado (para controle externo) |
| `icon` | `React.ReactNode` | ❌ | Ícone customizado do projeto |
| `disabled` | `boolean` | ❌ | Desabilitar o dropdown |
| `maxHeight` | `number` | ❌ | Altura máxima da lista (default: 200) |
| `containerStyle` | `StyleProp<ViewStyle>` | ❌ | Estilo customizado do container |
| `textStyle` | `StyleProp<TextStyle>` | ❌ | Estilo customizado do texto |
| `placeholderStyle` | `StyleProp<TextStyle>` | ❌ | Estilo customizado do placeholder |

## 📝 Exemplos de Uso

### 1. Horário de Almoço (Dados Locais)

```tsx
type LunchTime = {
  id: string;
  start: string;
  end: string;
  label: string;
};

const lunchTimes: LunchTime[] = [
  { id: '1', start: '11:00', end: '12:00', label: '11:00 a 12:00' },
  { id: '2', start: '12:00', end: '13:00', label: '12:00 a 13:00' },
  { id: '3', start: '13:00', end: '14:00', label: '13:00 a 14:00' },
];

const [selectedLunchTime, setSelectedLunchTime] = useState<LunchTime | null>(null);

<SelectDropdown<LunchTime>
  data={lunchTimes}
  labelKey="label"
  valueKey="id"
  onSelect={(item) => setSelectedLunchTime(item)}
  selectedValue={selectedLunchTime}
  placeholder="Selecione o horário de almoço"
/>
```

### 2. Categorias (Dados do Supabase)

```tsx
import { fetchCategories, type Category } from '../../lib/categories';

const [categories, setCategories] = useState<Category[]>([]);
const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

useEffect(() => {
  const loadCategories = async () => {
    const categoriesData = await fetchCategories();
    setCategories(categoriesData);
  };
  loadCategories();
}, []);

<SelectDropdown<Category>
  data={categories}
  labelKey="name"
  valueKey="id"
  onSelect={(category) => setSelectedCategory(category)}
  selectedValue={selectedCategory}
  placeholder="Selecione a categoria"
/>
```

### 3. Tempo de Negócio (Dados Locais)

```tsx
type BusinessTime = {
  value: string;
  label: string;
};

const businessTimeOptions: BusinessTime[] = [
  { value: 'less-1', label: 'Menos de 1 ano' },
  { value: '1-3', label: '1 a 3 anos' },
  { value: '3-5', label: '3 a 5 anos' },
  { value: 'more-5', label: 'Mais de 5 anos' },
];

const [selectedBusinessTime, setSelectedBusinessTime] = useState<BusinessTime | null>(null);

<SelectDropdown<BusinessTime>
  data={businessTimeOptions}
  labelKey="label"
  valueKey="value"
  onSelect={(item) => setSelectedBusinessTime(item)}
  selectedValue={selectedBusinessTime}
  placeholder="Selecione o tempo de negócio"
/>
```

### 4. Com Ícone Customizado

```tsx
import { IconChevronDown } from '../../lib/icons';

<SelectDropdown<Category>
  data={categories}
  labelKey="name"
  valueKey="id"
  onSelect={(category) => setSelectedCategory(category)}
  selectedValue={selectedCategory}
  placeholder="Selecione a categoria"
  icon={<IconChevronDown width={12} height={7.4} color="#E5102E" />}
/>
```

## 🔄 Onde Substituir os Modais Atuais

Este componente pode substituir os modais de seleção em:

### ✅ Já Implementado

1. **`app/(auth)/merchant-signup-business.tsx`**
   - ✅ Modal de "Área de atuação" (categorias)
   - ✅ Modal de "Tempo de Negócio"
   - ✅ Modal de "Horário de almoço"

2. **`app/(merchant)/profile/edit.tsx`**
   - ✅ Modal de "Área de atuação" (categorias)
   - ✅ Modal de "Tempo de Negócio"

3. **`app/(merchant)/services/create.tsx`**
   - ⚠️ Usa chips horizontais - pode ser mantido ou substituído

4. **`app/(merchant)/services/edit/[id].tsx`**
   - ⚠️ Usa chips horizontais - pode ser mantido ou substituído

### 📋 Passo a Passo para Substituição

#### Antes (Modal):

```tsx
const [showCategoryModal, setShowCategoryModal] = useState(false);
const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

<TouchableOpacity
  style={styles.selectInput}
  onPress={() => setShowCategoryModal(true)}
>
  <Text>{selectedCategory ? category.name : 'Selecione'}</Text>
  <IconChevronDown />
</TouchableOpacity>

<Modal visible={showCategoryModal}>
  {/* ... código do modal ... */}
</Modal>
```

#### Depois (SelectDropdown):

```tsx
const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

<SelectDropdown<Category>
  data={categories}
  labelKey="name"
  valueKey="id"
  onSelect={(category) => setSelectedCategory(category)}
  selectedValue={selectedCategory}
  placeholder="Selecione a categoria"
/>
```

## 🎨 Estilização Customizada

O componente aceita estilos customizados através das props:

```tsx
<SelectDropdown<Category>
  data={categories}
  labelKey="name"
  valueKey="id"
  onSelect={handleSelect}
  containerStyle={{ marginBottom: 20 }}
  textStyle={{ fontSize: 18 }}
  placeholderStyle={{ color: '#999' }}
/>
```

## 📚 Mais Exemplos

Veja o arquivo `SelectDropdown.examples.tsx` para exemplos completos de uso em diferentes cenários.

## 🔗 Referências

- Ícones disponíveis: `lib/icons.tsx`
- Categorias do Supabase: `lib/categories.ts`

