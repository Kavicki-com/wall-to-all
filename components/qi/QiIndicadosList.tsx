import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { formatBRL, getInitials } from '../../lib/formatters';
import type { QiIndicacao } from '../../lib/services/types';

export interface QiIndicadosListProps {
  /** Página atual de indicações a exibir. */
  items: QiIndicacao[];
  /** Página atual (1-based). */
  page: number;
  /** Total de páginas disponíveis. */
  totalPages: number;
  /** Texto exibido quando não há indicações. */
  emptyMessage: string;
  /** Disparado ao tocar em uma linha (recebe o id da indicação). */
  onPressItem: (id: string) => void;
  /** Disparado ao tocar em um número de página. */
  onPageChange: (page: number) => void;
  /** testID opcional para asserção nos testes/telas. */
  testID?: string;
}

// Item de paginação: um número de página ou uma reticência de lacuna.
type PageItem = number | 'ellipsis';

/**
 * Monta a sequência de páginas a exibir: sempre a primeira, a última, a atual e
 * suas vizinhas; lacunas viram "…". Para poucos totais (2-3) devolve todos os
 * números, sem reticências.
 */
function buildPageItems(current: number, total: number): PageItem[] {
  const items: PageItem[] = [];
  for (let p = 1; p <= total; p++) {
    const isEdge = p === 1 || p === total;
    const isNear = Math.abs(p - current) <= 1;
    if (isEdge || isNear) {
      items.push(p);
    } else if (items[items.length - 1] !== 'ellipsis') {
      items.push('ellipsis');
    }
  }
  return items;
}

/**
 * Lista "Amigos indicados" do QI (F4 — nodes 2628:6982/6983 e paginação
 * 2606:6480 do Figma). Cada linha é um cartão branco pressionável com avatar
 * (foto ou iniciais), nome em negrito e, à direita, o valor ganho em verde com
 * o rótulo "Você ganhou". Abaixo, uma paginação numerada (página ativa
 * preenchida em navy). Sem indicações, mostra apenas a mensagem vazia; com uma
 * única página, omite o rodapé de paginação.
 */
export const QiIndicadosList: React.FC<QiIndicadosListProps> = ({
  items,
  page,
  totalPages,
  emptyMessage,
  onPressItem,
  onPageChange,
  testID,
}) => {
  if (items.length === 0) {
    return (
      <View testID={testID}>
        <Text style={styles.emptyMessage} testID="qi-indicados-empty">
          {emptyMessage}
        </Text>
      </View>
    );
  }

  const showPagination = totalPages > 1;
  const pageItems = showPagination ? buildPageItems(page, totalPages) : [];

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.list}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            testID={`qi-indicado-${item.id}`}
            accessibilityRole="button"
            onPress={() => onPressItem(item.id)}
            style={styles.row}
          >
            <View style={styles.rowLeft}>
              {item.avatarUrl ? (
                <Image
                  testID={`qi-avatar-${item.id}`}
                  source={{ uri: item.avatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarInitials]}>
                  <Text style={styles.initials}>{getInitials(item.name)}</Text>
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.earned}>{formatBRL(item.earnedCents)}</Text>
              <Text style={styles.earnedLabel}>Você ganhou</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {showPagination && (
        <View testID="qi-pagination" style={styles.pagination}>
          {pageItems.map((item, index) => {
            if (item === 'ellipsis') {
              return (
                <View key={`ellipsis-${index}`} style={styles.ellipsis}>
                  <Text style={styles.ellipsisText}>…</Text>
                </View>
              );
            }
            const isActive = item === page;
            return (
              <Pressable
                key={item}
                testID={`qi-page-${item}`}
                accessibilityRole="button"
                accessibilityLabel={`Página ${item}`}
                accessibilityState={{ selected: isActive }}
                onPress={() => onPageChange(item)}
                style={[styles.pageButton, isActive && styles.pageButtonActive]}
              >
                <Text style={[styles.pageText, isActive && styles.pageTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
          <Pressable
            testID="qi-page-next"
            accessibilityRole="button"
            accessibilityLabel="Próxima página"
            disabled={page >= totalPages}
            onPress={() => onPageChange(Math.min(totalPages, page + 1))}
            style={styles.pageButton}
          >
            <Icon name="keyboard-arrow-right" size={20} color={colors.accent} />
          </Pressable>
        </View>
      )}
    </View>
  );
};

const AVATAR_SIZE = 40;
const PAGE_SIZE = 44;

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarInitials: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.contentLight,
  },
  name: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  earned: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.surfaceSuccess,
  },
  earnedLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 8,
    color: colors.textSecondary,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pageButton: {
    width: PAGE_SIZE,
    height: PAGE_SIZE,
    borderRadius: PAGE_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonActive: {
    backgroundColor: colors.brand,
  },
  pageText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  pageTextActive: {
    color: colors.contentLight,
  },
  ellipsis: {
    width: PAGE_SIZE,
    height: PAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ellipsisText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  emptyMessage: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
});
