import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ReviewStats } from '../../lib/hooks/useMerchantMetrics';

interface ReviewSummaryProps {
    stats: ReviewStats;
}

const ReviewSummary: React.FC<ReviewSummaryProps> = ({ stats }) => {
    const { average, total, distribution } = stats;

    // Find max count for percentage calculation
    const maxCount = Math.max(...Object.values(distribution), 1);

    const renderStars = (count: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <MaterialIcons
                key={i}
                name={i < Math.round(average) ? 'star' : 'star-border'}
                size={20}
                color={i < Math.round(average) ? '#F59E0B' : '#D1D5DB'}
            />
        ));
    };

    if (total === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Avaliações</Text>
                <View style={styles.emptyState}>
                    <MaterialIcons name="star-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Nenhuma avaliação ainda</Text>
                    <Text style={styles.emptySubtext}>
                        As avaliações dos clientes aparecerão aqui
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Avaliações</Text>

            <View style={styles.content}>
                {/* Average Section */}
                <View style={styles.averageSection}>
                    <Text style={styles.averageValue}>{average.toFixed(1)}</Text>
                    <View style={styles.starsRow}>{renderStars(Math.round(average))}</View>
                    <Text style={styles.totalText}>{total} avaliação{total !== 1 ? 'ões' : ''}</Text>
                </View>

                {/* Distribution Section */}
                <View style={styles.distributionSection}>
                    {[5, 4, 3, 2, 1].map((star) => (
                        <View key={star} style={styles.distributionRow}>
                            <Text style={styles.starLabel}>{star}</Text>
                            <MaterialIcons name="star" size={14} color="#F59E0B" />
                            <View style={styles.barContainer}>
                                <View
                                    style={[
                                        styles.barFill,
                                        {
                                            width: `${(distribution[star] / maxCount) * 100}%`,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.countLabel}>{distribution[star]}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    title: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 16,
        color: '#1F2937',
        marginBottom: 16,
    },
    content: {
        flexDirection: 'row',
        gap: 24,
    },
    averageSection: {
        alignItems: 'center',
        paddingRight: 24,
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
    },
    averageValue: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 40,
        color: '#1F2937',
        lineHeight: 48,
    },
    starsRow: {
        flexDirection: 'row',
        marginTop: 4,
        marginBottom: 8,
    },
    totalText: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 12,
        color: '#6B7280',
    },
    distributionSection: {
        flex: 1,
        gap: 6,
    },
    distributionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    starLabel: {
        fontFamily: 'Montserrat_500Medium',
        fontSize: 12,
        color: '#374151',
        width: 12,
        textAlign: 'right',
    },
    barContainer: {
        flex: 1,
        height: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: '#F59E0B',
        borderRadius: 4,
        minWidth: 4,
    },
    countLabel: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 11,
        color: '#9CA3AF',
        width: 24,
        textAlign: 'right',
    },
    emptyState: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    emptyText: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 14,
        color: '#374151',
        marginTop: 12,
    },
    emptySubtext: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 4,
        textAlign: 'center',
    },
});

export default ReviewSummary;
