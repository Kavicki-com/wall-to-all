import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ReferralMetric } from '../../lib/hooks/useMerchantMetrics';
import { formatCurrency } from '../../lib/formatters';

interface ReferralListProps {
    referrals: ReferralMetric[];
}

const ReferralList: React.FC<ReferralListProps> = ({ referrals }) => {
    if (!referrals || referrals.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Programa de Associados</Text>
                <View style={styles.emptyState}>
                    <MaterialIcons name="group-add" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Nenhuma indicação ainda</Text>
                    <Text style={styles.emptySubtext}>
                        Compartilhe seu código e ganhe comissões
                    </Text>
                </View>
            </View>
        );
    }

    const totalCommission = referrals.reduce(
        (sum, ref) => sum + ref.commissionEarned,
        0
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return { bg: '#DEF7EC', text: '#03543F' };
            case 'pending':
                return { bg: '#FEF3C7', text: '#92400E' };
            default:
                return { bg: '#F3F4F6', text: '#6B7280' };
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active':
                return 'Ativo';
            case 'pending':
                return 'Pendente';
            default:
                return status;
        }
    };

    const renderItem = ({ item }: { item: ReferralMetric }) => {
        const statusColors = getStatusColor(item.status);

        return (
            <View style={styles.referralItem}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {item.name.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={styles.date}>
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </Text>
                </View>
                <View style={styles.rightSection}>
                    <Text style={styles.commission}>
                        {formatCurrency(item.commissionEarned)}
                    </Text>
                    <View
                        style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}
                    >
                        <Text style={[styles.statusText, { color: statusColors.text }]}>
                            {getStatusLabel(item.status)}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Programa de Associados</Text>
                <View style={styles.totalBadge}>
                    <Text style={styles.totalLabel}>Total ganho</Text>
                    <Text style={styles.totalValue}>{formatCurrency(totalCommission)}</Text>
                </View>
            </View>

            <View style={styles.list}>
                {referrals.map((item) => (
                    <React.Fragment key={item.id}>
                        {renderItem({ item })}
                    </React.Fragment>
                ))}
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 16,
        color: '#1F2937',
    },
    totalBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignItems: 'flex-end',
    },
    totalLabel: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 10,
        color: '#6B7280',
    },
    totalValue: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 14,
        color: '#4A90E2',
    },
    list: {
        gap: 12,
    },
    referralItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E0E7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 16,
        color: '#4338CA',
    },
    info: {
        flex: 1,
    },
    name: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 14,
        color: '#1F2937',
    },
    date: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    rightSection: {
        alignItems: 'flex-end',
    },
    commission: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 14,
        color: '#10B981',
        marginBottom: 4,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    statusText: {
        fontFamily: 'Montserrat_500Medium',
        fontSize: 10,
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

export default ReferralList;
