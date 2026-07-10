import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';
import type { PixKey, PixKeyType } from '../../lib/services/types';

export interface PixKeySectionProps {
  keys: PixKey[];
  onAddPress: () => void;
  testID?: string;
}

// Rótulo pt-BR exibido para cada tipo de chave Pix.
const TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Aleatória',
};

// Alarga o alvo de toque do botão "adicionar" para conforto (altura já é 44).
const ADD_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Lista de chaves Pix da carteira: um cartão por chave (rótulo do tipo +
 * valor mascarado) seguido de um botão outline "Adicionar chave Pix".
 *
 * NÃO renderiza o título da seção ("Chaves Pix") — a tela pai é quem o exibe.
 * Componente puramente apresentacional; recebe as chaves já mascaradas.
 */
export const PixKeySection: React.FC<PixKeySectionProps> = ({ keys, onAddPress, testID }) => {
  return (
    <View style={styles.container} testID={testID}>
      {keys.map((key) => (
        <View key={key.id} testID={`pix-key-${key.id}`} style={styles.card}>
          <Text style={styles.label}>{TYPE_LABELS[key.type]}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {key.maskedValue}
          </Text>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adicionar chave Pix"
        testID="btn-add-pix"
        onPress={onAddPress}
        hitSlop={ADD_HIT_SLOP}
        style={styles.addButton}
      >
        <Text style={styles.addLabel}>+  Adicionar chave Pix</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  value: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  addButton: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
});
