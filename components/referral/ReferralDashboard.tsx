import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Share, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useReferral } from '../../lib/hooks/useReferral';
import { CustomButton } from '../CustomButton';
import { formatCurrency } from '../../lib/formatters';
import { useToast } from '../ui/ToastProvider';
import * as Clipboard from 'expo-clipboard';

interface ReferralDashboardProps {
    userType: 'client' | 'merchant';
}

const ReferralDashboard: React.FC<ReferralDashboardProps> = ({ userType }) => {
    const {
        referralCode,
        commissionSummary,
        referrals,
        isLoading,
        fetchReferralCode,
        fetchReferralsAndCommissions,
        getReferralLink
    } = useReferral();

    const { showSuccess } = useToast();

    useEffect(() => {
        fetchReferralCode();
        fetchReferralsAndCommissions();
    }, []);

    const handleCopyCode = async () => {
        if (referralCode?.code) {
            await Clipboard.setStringAsync(referralCode.code);
            showSuccess('Código copiado para a área de transferência!');
        }
    };

    const handleShareLink = async () => {
        if (!referralCode?.code) return;

        const link = getReferralLink(referralCode.code);
        const message = `Use meu código ${referralCode.code} para se cadastrar no Wall to All! ${link}`;

        try {
            await Share.share({
                message,
                url: link, // iOS supports url param
                title: 'Indique e Ganhe - Wall to All'
            });
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
        }
    };

    if (isLoading && !referralCode) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {/* Saldo Card */}
            <LinearGradient
                colors={['#4A90E2', '#357ABD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.balanceCard}
            >
                <View style={styles.balanceHeader}>
                    <Text style={styles.balanceLabel}>Saldo disponível</Text>
                    <MaterialIcons name="account-balance-wallet" size={24} color="#FFF" />
                </View>
                <Text style={styles.balanceValue}>
                    {formatCurrency(commissionSummary.availableBalance)}
                </Text>

                <View style={styles.balanceFooter}>
                    <View style={styles.balanceItem}>
                        <Text style={styles.balanceItemLabel}>Pendente</Text>
                        <Text style={styles.balanceItemValue}>{formatCurrency(commissionSummary.pendingBalance)}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.balanceItem}>
                        <Text style={styles.balanceItemLabel}>Total ganho</Text>
                        <Text style={styles.balanceItemValue}>{formatCurrency(commissionSummary.totalEarned)}</Text>
                    </View>
                </View>

                {commissionSummary.availableBalance > 0 && (
                    <TouchableOpacity
                        style={styles.withdrawButton}
                        onPress={() => showSuccess('Solicitação de saque em breve!')}
                    >
                        <Text style={styles.withdrawButtonText}>Solicitar Saque</Text>
                    </TouchableOpacity>
                )}
            </LinearGradient>

            {/* Seção Código */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Seu código de indicação</Text>
                <Text style={styles.sectionSubtitle}>
                    Compartilhe seu código e ganhe 20% das comissões geradas pelos indicados.
                </Text>

                <View style={styles.codeContainer}>
                    <View style={styles.codeBox}>
                        <Text style={styles.codeText}>
                            {referralCode?.code || '---'}
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                        <MaterialIcons name="content-copy" size={24} color="#4A90E2" />
                    </TouchableOpacity>
                </View>

                <CustomButton
                    title="Compartilhar Link"
                    onPress={handleShareLink}
                    variant="primary"
                    style={styles.shareButton}
                    leftIcon={<MaterialIcons name="share" size={20} color="#FFF" />}
                />
            </View>

            {/* Histórico */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Indicações ({commissionSummary.referralCount})</Text>

                {referrals.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="person-add" size={48} color="#CCC" />
                        <Text style={styles.emptyStateText}>Você ainda não tem indicações.</Text>
                        <Text style={styles.emptyStateSubtext}>Comece a compartilhar seu código agora!</Text>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {referrals.map((referral) => (
                            <View key={referral.id} style={styles.referralItem}>
                                <View style={styles.referralAvatar}>
                                    <Text style={styles.avatarText}>
                                        {referral.referred?.full_name?.charAt(0).toUpperCase() || '?'}
                                    </Text>
                                </View>
                                <View style={styles.referralInfo}>
                                    <Text style={styles.referralName}>
                                        {referral.referred?.full_name || 'Usuário'}
                                    </Text>
                                    <Text style={styles.referralDate}>
                                        {new Date(referral.created_at || '').toLocaleDateString('pt-BR')}
                                    </Text>
                                </View>
                                <View style={styles.referralStatus}>
                                    <View style={[
                                        styles.statusBadge,
                                        referral.status === 'active' ? styles.statusActive :
                                            referral.status === 'pending' ? styles.statusPending : styles.statusExpired
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            referral.status === 'active' ? styles.statusTextActive :
                                                referral.status === 'pending' ? styles.statusTextPending : styles.statusTextExpired
                                        ]}>
                                            {referral.status === 'active' ? 'Ativo' :
                                                referral.status === 'pending' ? 'Pendente' : 'Inativo'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
    },
    balanceCard: {
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    balanceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    balanceLabel: {
        fontFamily: 'Montserrat_500Medium',
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    balanceValue: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 36,
        color: '#FFF',
        marginBottom: 24,
    },
    balanceFooter: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 12,
        padding: 12,
        justifyContent: 'space-between',
    },
    balanceItem: {
        flex: 1,
        alignItems: 'center',
    },
    divider: {
        width: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    balanceItemLabel: {
        fontFamily: 'Montserrat_400Regular',
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 4,
    },
    balanceItemValue: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 16,
        color: '#FFF',
    },
    withdrawButton: {
        marginTop: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    withdrawButtonText: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 14,
        color: '#FFF',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 18,
        color: '#1F2937',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
        lineHeight: 20,
    },
    codeContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    codeBox: {
        flex: 1,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderStyle: 'dashed',
    },
    codeText: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 20,
        color: '#4A90E2',
        letterSpacing: 2,
    },
    copyButton: {
        width: 56,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareButton: {
        borderRadius: 12,
    },
    list: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    referralItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    referralAvatar: {
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
    referralInfo: {
        flex: 1,
    },
    referralName: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 14,
        color: '#1F2937',
    },
    referralDate: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    referralStatus: {
        alignItems: 'flex-end',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusActive: {
        backgroundColor: '#DEF7EC',
    },
    statusPending: {
        backgroundColor: '#FEF3C7',
    },
    statusExpired: {
        backgroundColor: '#FEE2E2',
    },
    statusText: {
        fontSize: 12,
        fontFamily: 'Montserrat_500Medium',
    },
    statusTextActive: {
        color: '#03543F',
    },
    statusTextPending: {
        color: '#92400E',
    },
    statusTextExpired: {
        color: '#991B1B',
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    emptyStateText: {
        fontFamily: 'Montserrat_600SemiBold',
        fontSize: 16,
        color: '#374151',
        marginTop: 16,
    },
    emptyStateSubtext: {
        fontFamily: 'Roboto_400Regular',
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 4,
        textAlign: 'center',
    },
});

export default ReferralDashboard;
