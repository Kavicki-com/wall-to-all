import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PeriodType } from '../../lib/hooks/useMerchantMetrics';

interface PeriodFilterProps {
    selectedPeriod: PeriodType;
    onChangePeriod: (period: PeriodType) => void;
}

const periods: { key: PeriodType; label: string }[] = [
    { key: 'day', label: 'Dia' },
    { key: 'month', label: 'Mês' },
    { key: 'year', label: 'Ano' },
];

const PeriodFilter: React.FC<PeriodFilterProps> = ({
    selectedPeriod,
    onChangePeriod,
}) => {
    return (
        <View style={styles.container}>
            {periods.map((period) => (
                <TouchableOpacity
                    key={period.key}
                    style={[
                        styles.chip,
                        selectedPeriod === period.key && styles.chipActive,
                    ]}
                    onPress={() => onChangePeriod(period.key)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={[
                            styles.chipText,
                            selectedPeriod === period.key && styles.chipTextActive,
                        ]}
                    >
                        {period.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    chip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipActive: {
        backgroundColor: '#E5102E',
        borderColor: '#E5102E',
    },
    chipText: {
        fontFamily: 'Montserrat_500Medium',
        fontSize: 14,
        color: '#6B7280',
    },
    chipTextActive: {
        color: '#FFF',
    },
});

export default PeriodFilter;
