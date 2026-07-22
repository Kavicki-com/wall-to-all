import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';

export interface QiCodeCardProps {
  /** Código de indicação do usuário (ex.: "QI-HOG23-3892"). */
  code: string;
  /** Chamada de compartilhamento; varia por lado/estado (o chamador decide o texto). */
  subtitle: string;
  /** Disparado ao tocar no ícone de compartilhar. */
  onShare: () => void;
  /** testID opcional para asserção nos testes/telas. */
  testID?: string;
}

/**
 * Cartão "Compartilhe seu código" do QI (F4 — nodes 2628:6974/6976 e 2628:7083/7085).
 *
 * Puramente apresentacional: um subtítulo (recebido por prop, muda conforme o
 * lado/estado) acima do campo com o rótulo "Código", o código em negrito e o
 * ícone de compartilhar pressionável.
 */
export const QiCodeCard: React.FC<QiCodeCardProps> = ({ code, subtitle, onShare, testID }) => (
  <View testID={testID} style={styles.container}>
    <Text style={styles.subtitle}>{subtitle}</Text>
    <View style={styles.field}>
      <Text style={styles.label}>Código</Text>
      <Pressable
        testID="qi-code-share"
        accessibilityRole="button"
        accessibilityLabel="Compartilhar código"
        onPress={onShare}
        style={styles.codeButton}
      >
        <Text style={styles.code}>{code}</Text>
        <Icon name="ios-share" size={20} color={colors.brand} />
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  subtitle: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
  },
  label: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  code: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
});
