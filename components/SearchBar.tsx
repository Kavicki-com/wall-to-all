import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type SearchBarVariant = 'grey' | 'primary';
type IconMode = 'search' | 'close' | 'auto';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSearchPress?: () => void;
  onSubmit?: () => void;

  showFilterButton?: boolean;
  onPressFilter?: () => void;

  inputProps?: TextInputProps;
  containerStyle?: StyleProp<ViewStyle>;

  variant?: SearchBarVariant;
  iconMode?: IconMode;
};

const VARIANT_STYLES: Record<SearchBarVariant, ViewStyle> = {
  grey: {
    borderColor: '#474747', // border/grey
    borderWidth: 1,
  },
  primary: {
    borderColor: '#000E3D', // border/primary
    borderWidth: 2,
  },
};

const SearchBar: React.FC<Props> = ({
  value,
  onChangeText,
  placeholder = 'Procurar serviços',
  onClear,
  onSearchPress,
  onSubmit,
  showFilterButton = true,
  onPressFilter,
  inputProps,
  containerStyle,
  variant = 'grey',
  iconMode = 'auto',
}) => {
  const hasText = value.trim().length > 0;

  let showClose = false;
  if (iconMode === 'close') {
    showClose = true;
  } else if (iconMode === 'search') {
    showClose = false;
  } else {
    showClose = !!onClear && hasText;
  }

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit();
    } else if (onSearchPress) {
      onSearchPress();
    }
  };

  const handleIconPress = () => {
    if (showClose && onClear) {
      onClear();
      return;
    }

    if (onSearchPress) {
      onSearchPress();
    }
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View style={[styles.searchContainer, VARIANT_STYLES[variant]]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9E9E9E"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          {...inputProps}
        />

        <TouchableOpacity
          onPress={handleIconPress}
          disabled={!showClose && !onSearchPress}
          hitSlop={15}
        >
          <MaterialIcons
            name={showClose ? 'close' : 'search'}
            size={20}
            color="#0F0F0F"
          />
        </TouchableOpacity>
      </View>

      {showFilterButton && (
        <TouchableOpacity
          style={styles.filterButton}
          onPress={onPressFilter || (() => {})}
          activeOpacity={0.8}
          disabled={!onPressFilter}
        >
          <MaterialIcons name="filter-list" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SearchBar;

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    columnGap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    marginRight: 8,
    paddingVertical: 0,
  },
  filterButton: {
    marginLeft: 8,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5102E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E5102E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
});
