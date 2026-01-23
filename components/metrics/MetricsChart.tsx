import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppointmentsByPeriod, RevenueByPeriod } from '../../lib/hooks/useMerchantMetrics';
import { formatCurrency } from '../../lib/formatters';

interface MetricsChartProps {
    data: AppointmentsByPeriod[] | RevenueByPeriod[];
    type: 'appointments' | 'revenue';
    title: string;
}

const { width: screenWidth } = Dimensions.get('window');
const BAR_WIDTH = 40;
const BAR_GAP = 12;
const MAX_BAR_HEIGHT = 120;

const MetricsChart: React.FC<MetricsChartProps> = ({ data, type, title }) => {
    if (!data || data.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Sem dados para exibir</Text>
                </View>
            </View>
        );
    }

    // Get the max value for scaling
    const maxValue = Math.max(
        ...data.map((item) => ('count' in item ? item.count : item.amount))
    );

    // Calculate bar height percentage
    const getBarHeight = (value: number) => {
        if (maxValue === 0) return 0;
        return (value / maxValue) * MAX_BAR_HEIGHT;
    };

    const getValue = (item: AppointmentsByPeriod | RevenueByPeriod) => {
        return 'count' in item ? item.count : item.amount;
    };

    const formatValue = (value: number) => {
        if (type === 'revenue') {
            return formatCurrency(value);
        }
        return value.toString();
    };

    const gradientColors: readonly [string, string] =
        type === 'appointments' ? ['#4A90E2', '#60A5FA'] : ['#10B981', '#34D399'];

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chartContainer}
            >
                <View style={styles.chart}>
                    {/* Y-axis labels */}
                    <View style={styles.yAxis}>
                        <Text style={styles.yAxisLabel}>{formatValue(maxValue)}</Text>
                        <Text style={styles.yAxisLabel}>{formatValue(maxValue / 2)}</Text>
                        <Text style={styles.yAxisLabel}>0</Text>
                    </View>

                    {/* Bars */}
                    <View style={styles.barsContainer}>
                        {data.map((item, index) => {
                            const value = getValue(item);
                            const barHeight = Math.max(getBarHeight(value), 4); // Minimum height of 4
                            const barStyle: ViewStyle = { ...styles.bar, height: barHeight };

                            return (
                                <View key={index} style={styles.barWrapper}>
                                    <View style={[styles.barBackground, { height: MAX_BAR_HEIGHT }]}>
                                        <LinearGradient
                                            colors={[...gradientColors]}
                                            start={{ x: 0, y: 1 }}
                                            end={{ x: 0, y: 0 }}
                                            style={barStyle}
                                        />
                                    </View>
                                    <Text style={styles.barValue}>{formatValue(value)}</Text>
                                    <Text style={styles.barLabel} numberOfLines={1}>
                                        {item.label}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>
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
    chartContainer: {
        paddingRight: 16,
    },
    chart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    yAxis: {
        height: MAX_BAR_HEIGHT + 40,
        justifyContent: 'space-between',
        paddingRight: 8,
        paddingBottom: 40,
    },
    yAxisLabel: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 10,
        color: '#9CA3AF',
        textAlign: 'right',
        minWidth: 40,
    },
    barsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: BAR_GAP,
        paddingLeft: 8,
    },
    barWrapper: {
        alignItems: 'center',
        width: BAR_WIDTH + 10,
    },
    barBackground: {
        width: BAR_WIDTH,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    bar: {
        width: BAR_WIDTH,
        borderRadius: 8,
    },
    barValue: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 9,
        color: '#374151',
        marginTop: 4,
        textAlign: 'center',
    },
    barLabel: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 10,
        color: '#6B7280',
        marginTop: 2,
        textAlign: 'center',
        maxWidth: BAR_WIDTH + 10,
    },
    emptyState: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    emptyText: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 14,
        color: '#9CA3AF',
    },
});

export default MetricsChart;
