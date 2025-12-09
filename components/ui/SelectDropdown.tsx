import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons'; 

interface SelectDropdownProps<T> {
  data: T[];
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
        <Text style={[styles.buttonText, strong && styles.buttonTextStrong, !selectedValue && styles.placeholderText]}>
          {selectedValue ? String(selectedValue[labelKey]) : placeholder}
        </Text>
        <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#000E3D" />
      </TouchableOpacity>

      {isOpen && (
        <>
          <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />
          <View style={[styles.dropdownList, maxHeight ? { maxHeight } : null]}>
            <FlatList
              data={data}
              keyExtractor={(item) => String(item[valueKey] ?? item[labelKey] ?? Math.random())}
              nestedScrollEnabled={true}
              scrollEnabled={data.length > 3}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => handleSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={String(item[labelKey])}
                >
                  <Text style={styles.itemText}>{String(item[labelKey])}</Text>
                  {selectedValue && String(selectedValue[valueKey]) === String(item[valueKey]) && (
                    <Feather name="check" size={16} color="#000E3D" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', width: '100%' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#474747', borderRadius: 4, paddingHorizontal: 12, height: 50 },
  buttonActive: { borderColor: '#000E3D', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  dropdownList: { position: 'absolute', top: 48, left: 0, right: 0, backgroundColor: '#FFF', borderWidth: 1, borderTopWidth: 0, borderColor: '#000E3D', borderBottomLeftRadius: 4, borderBottomRightRadius: 4, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: {width:0, height:4}, maxHeight: 200, zIndex: 1001 },
  item: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  itemText: { fontSize: 14, fontFamily: 'Montserrat_400Regular', color: '#0F0F0F' },
  buttonText: { fontSize: 16, fontFamily: 'Montserrat_400Regular', color: '#0F0F0F' },
  buttonTextStrong: { fontFamily: 'Montserrat_700Bold' },
  placeholderText: { color: '#474747' }
});
