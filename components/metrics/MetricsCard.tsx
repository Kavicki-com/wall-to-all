import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../ui/Icon';

interface MetricsCardProps {
    title: string;
    value: string | number;
    icon: string;
    iconFamily?: 'MaterialIcons' | 'MaterialSymbols' | 'MaterialCommunityIcons' | 'FontAwesome6';
    subtitle?: string;
    variant?: 'primary' | 'success' | 'warning' | 'info';
}

const variantColors = {
    primary: { gradient: ['#E5102E', '#FF4D6A'] as const, icon: '#FFF' },
    success: { gradient: ['#10B981', '#34D399'] as const, icon: '#FFF' },
    warning: { gradient: ['#F59E0B', '#FBBF24'] as const, icon: '#FFF' },
    info: { gradient: ['#4A90E2', '#60A5FA'] as const, icon: '#FFF' },
};

const MetricsCard: React.FC<MetricsCardProps> = ({
    title,
    value,
    icon,
    iconFamily = 'MaterialIcons',
    subtitle,
    variant = 'primary',
}) => {
    const colors = variantColors[variant];

    return (
        <LinearGradient
            colors={[...colors.gradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
        >
            <View style={styles.iconContainer}>
                <Icon name={icon} family={iconFamily} size={28} color={colors.icon} />
            </View>
            <View style={styles.content}>
                <Text style={styles.value}>{value}</Text>
                <Text style={styles.title}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    card: {
        flex: 1,
        minWidth: 140,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 4,
        marginVertical: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    content: {
        flex: 1,
    },
    value: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 24,
        color: '#FFF',
        marginBottom: 4,
    },
    title: {
        fontFamily: 'Montserrat_500Medium',
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    subtitle: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: 4,
    },
});

export default MetricsCard;
