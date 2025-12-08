import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { IconChevronDown } from '../../lib/icons';

export interface SelectDropdownProps<T> {
  /** Array de dados para exibir no dropdown */
  data: T[];
  /** Chave do objeto que será exibida como texto (ex: 'name', 'label', 'time') */
  labelKey: keyof T | ((item: T) => string);
  /** Chave do objeto que é o valor único (ex: 'id', 'value') */
  valueKey: keyof T | ((item: T) => any);
  /** Função chamada quando um item é selecionado */
  onSelect: (item: T) => void;
  /** Texto exibido quando nenhum item está selecionado */
  placeholder?: string;
  /** Item selecionado atualmente (para controle externo) */
  selectedValue?: T | null;
  /** Componente de ícone customizado (opcional) */
  icon?: React.ReactNode;
  /** Estilo customizado para o container do input */
  containerStyle?: any;
  /** Estilo customizado para o texto do input */
  textStyle?: any;
  /** Estilo customizado para o placeholder */
  placeholderStyle?: any;
  /** Usar estilo "strong" (borda mais grossa) - para campos obrigatórios */
  strong?: boolean;
  /** Altura máxima da lista dropdown */
  maxHeight?: number;
  /** Desabilitar o dropdown */
  disabled?: boolean;
  /** Estilo customizado para o item da lista */
  itemStyle?: any;
  /** Estilo customizado para o item selecionado */
  selectedItemStyle?: any;
}

/**
 * Componente de Dropdown Genérico e Reutilizável
 * 
 * O dropdown abre diretamente abaixo do campo de input, usando Modal para ficar por cima.
 */
function SelectDropdown<T extends Record<string, any>>({
  data,
  labelKey,
  valueKey,
  onSelect,
  placeholder = 'Selecione aqui',
  selectedValue = null,
  icon,
  containerStyle,
  textStyle,
  placeholderStyle,
  maxHeight = 200,
  disabled = false,
  itemStyle,
  selectedItemStyle,
  strong = false,
}: SelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<View>(null);

  // Função helper para extrair o label de um item
  const getLabel = (item: T): string => {
    if (typeof labelKey === 'function') {
      return labelKey(item);
    }
    const value = item[labelKey];
    return value != null ? String(value) : '';
  };

  // Função helper para extrair o valor único de um item
  const getValue = (item: T): any => {
    if (typeof valueKey === 'function') {
      return valueKey(item);
    }
    return item[valueKey];
  };

  // Verifica se um item está selecionado
  const isSelected = (item: T): boolean => {
    if (!selectedValue) return false;
    return getValue(selectedValue) === getValue(item);
  };

  // Texto exibido no input
  const displayText = selectedValue ? getLabel(selectedValue) : placeholder;
  const isPlaceholder = !selectedValue;

  // Handler para selecionar um item
  const handleSelect = (item: T) => {
    onSelect(item);
    setIsOpen(false);
  };

  // Medir posição do input quando abrir
  const handleOpen = () => {
    if (disabled) return;
    containerRef.current?.measureInWindow((x, y, width, height) => {
      setDropdownLayout({ x, y: y + height, width, height });
      setIsOpen(true);
    });
  };

  // Renderizar ícone
  const renderIcon = () => {
    if (icon) {
      return <View style={styles.iconContainer}>{icon}</View>;
    }
    return (
      <View style={styles.iconContainer}>
        <IconChevronDown width={12} height={7.4} color="#0F0F0F" />
      </View>
    );
  };

  return (
    <>
      <View style={[styles.container, containerStyle]} ref={containerRef}>
        {/* Input Trigger */}
        <TouchableOpacity
          style={[
            styles.input,
            strong && styles.inputStrong,
            disabled && styles.inputDisabled,
            isOpen && styles.inputOpen,
          ]}
          onPress={handleOpen}
          activeOpacity={0.8}
          disabled={disabled}
        >
          <Text
            style={[
              styles.inputText,
              isPlaceholder && [styles.placeholderText, placeholderStyle],
              textStyle,
            ]}
            numberOfLines={1}
          >
            {displayText}
          </Text>
          {renderIcon()}
        </TouchableOpacity>
      </View>

      {/* Modal para renderizar o dropdown por cima de tudo */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            {/* Dropdown List - Posicionado exatamente abaixo do input */}
            {isOpen && data && data.length > 0 && (
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.dropdownContainer,
                    {
                      top: dropdownLayout.y,
                      left: dropdownLayout.x,
                      width: dropdownLayout.width,
                    },
                  ]}
                >
                  <ScrollView
                    style={{ maxHeight }}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {data.map((item, index) => {
                      const selected = isSelected(item);
                      const isLast = index === data.length - 1;
                      const label = getLabel(item);

                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.listItem,
                            selected && styles.listItemSelected,
                            isLast && styles.listItemLast,
                            itemStyle,
                            selected && selectedItemStyle,
                          ]}
                          onPress={() => handleSelect(item)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.listItemText,
                              selected && styles.listItemTextSelected,
                            ]}
                          >
                            {label || 'Sem nome'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    backgroundColor: '#FEFEFE',
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 56,
  },
  inputOpen: {
    borderColor: '#87CEEB', // Light blue border when open (like in the image)
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  inputStrong: {
    borderWidth: 2,
    borderColor: '#0F0F0F',
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: '#F5F5F5',
  },
  inputText: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
    marginRight: 8,
  },
  placeholderText: {
    color: '#0F0F0F',
  },
  iconContainer: {
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownContainer: {
    position: 'absolute',
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#87CEEB', // Light blue border (like in the image)
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    maxHeight: 200,
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FEFEFE',
  },
  listItemSelected: {
    backgroundColor: '#FEFEFE',
  },
  listItemLast: {
    borderBottomWidth: 0,
  },
  listItemText: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  listItemTextSelected: {
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
});

export default SelectDropdown;
