import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../lib/theme';

interface SelectDropdownProps<T> {
  data: readonly T[] | T[];
  labelKey?: keyof T;
  valueKey?: keyof T;
  placeholder?: string;
  selectedValue?: T | null;
  onSelect: (item: T) => void;
  maxHeight?: number;
  strong?: boolean;
}

export default function SelectDropdown<T>({
  data,
  labelKey = 'label' as keyof T,
  valueKey = 'value' as keyof T,
  placeholder = 'Selecione',
  selectedValue,
  onSelect,
  maxHeight,
  strong,
}: SelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (item: T) => {
    onSelect(item);
    setIsOpen(false);
  };

  return (
    <View style={[styles.container, isOpen && { zIndex: 1000 }]}>
      <TouchableOpacity
        style={[styles.button, isOpen && styles.buttonActive]}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={[
          styles.buttonText,
          strong && selectedValue && styles.buttonTextStrong,
          !selectedValue && styles.placeholderText
        ]}>
          {selectedValue ? String(selectedValue[labelKey]) : placeholder}
        </Text>
        <MaterialIcons name={isOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={20} color={colors.brand} />
      </TouchableOpacity>

      {isOpen && (
        <>
          <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />
          <View style={[styles.dropdownList, maxHeight ? { maxHeight } : styles.dropdownList]}>
            <ScrollView
              nestedScrollEnabled={true}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
              bounces={false}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
            >
              {data.map((item, index) => (
                <TouchableOpacity
                  key={String(item[valueKey] ?? item[labelKey] ?? index)}
                  style={styles.item}
                  onPress={() => handleSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={String(item[labelKey])}
                >
                  <Text style={styles.itemText}>{String(item[labelKey])}</Text>
                  {selectedValue && String(selectedValue[valueKey]) === String(item[valueKey]) && (
                    <MaterialIcons name="check" size={16} color={colors.brand} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', width: '100%' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.textSecondary, borderRadius: 4, paddingHorizontal: 12, height: 56 },
  buttonActive: { borderColor: colors.brand, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  backdrop: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, zIndex: 999 },
  dropdownList: { position: 'absolute', top: 54, left: 0, right: 0, backgroundColor: '#FFF', borderWidth: 1, borderTopWidth: 0, borderColor: colors.brand, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 4 }, maxHeight: 200, zIndex: 1001, overflow: 'hidden' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  item: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  itemText: { fontSize: 14, fontFamily: 'Montserrat_400Regular', color: colors.textPrimary },
  buttonText: { fontSize: 16, fontFamily: 'Montserrat_400Regular', color: colors.textPrimary },
  buttonTextStrong: { fontFamily: 'Montserrat_700Bold' },
  placeholderText: { color: colors.brand }
});
