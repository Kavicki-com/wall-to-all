import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { safeGoBack } from '../../../lib/router-utils';

import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import SearchBar from '../../../components/SearchBar';
import { logger } from '../../../lib/logger';
import { Category } from '../../../lib/types';

type SimpleServiceItem = {
  id: number;
  name: string;
  category_name?: string;
};

const SearchingScreen: React.FC = () => {
  const router = useRouter();

  const [searchText, setSearchText] = useState('');
  const [hasSelectedService, setHasSelectedService] = useState(false);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<SimpleServiceItem[]>([]);

  // Sempre deixa "Outros" por último
  const getSortedCategories = () => {
    if (!categories) return [];
    const others: Category[] = [];
    const rest: Category[] = [];
    categories.forEach((cat) => {
      const name = cat.name.trim().toLowerCase();
      if (name === 'outros') {
        others.push(cat);
      } else {
        rest.push(cat);
      }
    });
    rest.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return [...rest, ...others];
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      setSearchText('');
      setHasSelectedService(false);
    }, [])
  );

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (catError) throw catError;
      setCategories((catData || []) as Category[]);

      const { data: servData, error: servError } = await supabase
        .from('services')
        .select(
          `
          id,
          name,
          categories (name)
        `,
        )
        .order('name');

      if (servError) throw servError;

      const formatted =
        servData?.map((item: { id: number; name: string; categories?: { name?: string } | { name?: string }[] }) => {
          const categoryName = Array.isArray(item.categories) 
            ? item.categories[0]?.name 
            : item.categories?.name;
          return {
            id: item.id,
            name: item.name,
            category_name: categoryName,
          };
        }) ?? [];

      setServices(formatted);
    } catch (error) {
      logger.error('Erro ao carregar dados da busca:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    const value = searchText.trim();
    if (!value) return;

    router.push({
      pathname: '/(client)/search/results',
      params: { q: value },
    });
  };

  const handleSelectService = (name: string) => {
    // Limpa o texto de busca para fechar o dropdown
    setSearchText(name);
    setHasSelectedService(true);

    // Redireciona para a tela de resultados
    router.push({
      pathname: '/(client)/search/results',
      params: { q: name },
    });
  };

  const handleBack = () => {
    setSearchText('');
    setHasSelectedService(false);
    safeGoBack('/(client)/home');
  };

  const trimmedSearch = searchText.trim().toLowerCase();

  const suggestions: SimpleServiceItem[] =
    !loading && trimmedSearch.length > 0
      ? services
          .filter((service) =>
            service.name.toLowerCase().includes(trimmedSearch),
          )
          .slice(0, 5)
      : [];

  const renderSuggestionItem = ({ item }: { item: SimpleServiceItem }) => (
    <TouchableOpacity
      style={styles.dropdownItem}
      onPress={() => handleSelectService(item.name)}
    >
      <Text style={styles.dropdownText} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer
      scroll={false}
      hasHeader={true}
      hasTabBar={false}
      backgroundColor="#FEFEFE"
      header={<AppHeader showBackButton onPressBack={handleBack} />}
    >
      {/* NENHUM card aqui, só um container "cru" */}
      <View style={styles.content}>
        {/* SearchBar em cápsula com borda azul */}
        <SearchBar
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
            setHasSelectedService(false);
          }}
          onSearchPress={handleSearchSubmit}
          onSubmit={handleSearchSubmit}
          onClear={() => {
            setSearchText('');
            setHasSelectedService(false);
          }}
          variant="primary" // borda azul 2px
          iconMode={hasSelectedService ? 'close' : 'search'}
          showFilterButton={false}
          containerStyle={styles.searchBarContainer}
        />

        {/* Dropdown */}
        {suggestions.length > 0 && (
          <View style={styles.dropdownContainer}>
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              renderItem={renderSuggestionItem}
              ItemSeparatorComponent={() => (
                <View style={styles.dropdownSeparator} />
              )}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={suggestions.length > 4}
            />
          </View>
        )}

        {/* Chips */}
        {categories.length > 0 && (
          <View style={styles.chipsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsList}
            >
              {getSortedCategories().map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.chip}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: '/(client)/search/results',
                      params: {
                        category: category.name,
                        q: category.name,
                      },
                    })
                  }
                >
                  <Text style={styles.chipText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
};

export default SearchingScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: '#FEFEFE',
    paddingTop: 16,
  },

  // tira padding/margin extra da SearchBar
  searchBarContainer: {
    paddingHorizontal: 0,
    marginTop: 0,
  },

  dropdownContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEFEFE',
    maxHeight: 260,
  },
  dropdownItem: {
    height: 44,
    justifyContent: 'center',
  },
  dropdownText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#DBDBDB',
    width: '100%',
  },

  chipsWrapper: {
    marginTop: 16,
  },
  chipsList: {
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#000E3D',
    backgroundColor: '#FEFEFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#000E3D',
  },
});
