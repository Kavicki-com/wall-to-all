import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconBack, IconSearch, IconNotification } from '../../../lib/icons';
import { sortCategories } from '../../../lib/categoryUtils';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

type Service = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  business_id: string;
  business: {
    id: string;
    business_name: string;
    logo_url: string | null;
  };
};

type Category = {
  id: number;
  name: string;
};

const SearchScreen: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Service[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 2) {
      performSearch();
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  const loadCategories = async () => {
    try {
      const { data: categoriesData, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Erro ao carregar categorias:', error);
        return;
      }

      if (categoriesData) {
        // Ordenar: alfabética, mas "outros" sempre por último
        const sortedCategories = sortCategories(categoriesData);
        setCategories(sortedCategories);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const performSearch = async () => {
    try {
      setLoading(true);

      const query = searchQuery.toLowerCase().trim();

      // Buscar serviços para sugestões
      const { data: servicesData } = await supabase
        .from('services')
        .select('*, business:business_profiles(id, business_name, logo_url)')
        .ilike('name', `%${query}%`)
        .limit(5);

      if (servicesData) {
        setSuggestions(servicesData as Service[]);
      }
    } catch (error) {
      console.error('Erro ao buscar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionPress = (service: Service) => {
    // Redirecionar para a tela de resultados com o nome do serviço como busca
    router.push({
      pathname: '/(client)/search/results',
      params: { q: service.name },
    });
  };

  const handleCategoryPress = (categoryName: string) => {
    router.push({
      pathname: '/(client)/search/results',
      params: { q: categoryName, category: categoryName },
    });
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim().length > 0) {
      router.push({
        pathname: '/(client)/search/results',
        params: { q: searchQuery },
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar with Gradient */}
      <View style={styles.topBarContainer}>
        <LinearGradient
          colors={['#000E3D', '#000E3D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <RadialGradient
                id="grad"
                cx="50%"
                cy="50%"
                r="50%"
                gradientUnits="userSpaceOnUse"
                gradientTransform="matrix(1 0 0 0.5 0 0)"
              >
                <Stop offset="0%" stopColor="#D6E0FF" />
                <Stop offset="100%" stopColor="#000E3D" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" opacity="0.2" />
          </Svg>
          <View style={styles.topBarContent}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <IconBack size={24} color="#FEFEFE" />
            </TouchableOpacity>
            <IconNotification size={24} color="#FEFEFE" />
          </View>
        </LinearGradient>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.comboBoxContainer}>
          {/* Search Input */}
          <View style={styles.searchInputContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar serviços ou lojas..."
              placeholderTextColor="#9E9E9E"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              autoFocus
            />
            <IconSearch size={18} color="#0F0F0F" />
          </View>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsDropdown}>
              {suggestions.map((service, index) => (
                <React.Fragment key={service.id}>
                  <TouchableOpacity
                    style={styles.suggestionOption}
                    onPress={() => handleSuggestionPress(service)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {service.name}
                    </Text>
                  </TouchableOpacity>
                  {index < suggestions.length - 1 && <View style={styles.suggestionDivider} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Category Chips */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
            contentContainerStyle={styles.categoriesContent}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryChip}
                onPress={() => handleCategoryPress(cat.name)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar por categoria ${cat.name}`}
              >
                <Text style={styles.categoryChipText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBarContainer: {
    height: 70,
  },
  headerGradient: {
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    backgroundColor: '#FEFEFE',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 16,
  },
  comboBoxContainer: {
    gap: 4,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEFEFE',
    borderWidth: 2,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  suggestionsDropdown: {
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 4,
    overflow: 'hidden',
  },
  suggestionOption: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  suggestionText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  suggestionDivider: {
    height: 1,
    backgroundColor: '#DBDBDB',
    marginHorizontal: 0,
  },
  categoriesContainer: {
    marginTop: 8,
  },
  categoriesContent: {
    gap: 4,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginRight: 4,
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#000E3D',
  },
});
