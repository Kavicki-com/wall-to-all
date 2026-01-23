import React, { useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import { useMerchantMetrics } from '../../../lib/hooks/useMerchantMetrics';
import { formatCurrency } from '../../../lib/formatters';
import {
    MetricsCard,
    PeriodFilter,
    MetricsChart,
    ReviewSummary,
    ReferralList,
} from '../../../components/metrics';

const MetricsScreen: React.FC = () => {
    const {
        isLoading,
        metrics,
        selectedPeriod,
        fetchMetrics,
        changePeriod,
    } = useMerchantMetrics();

    const [refreshing, setRefreshing] = React.useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchMetrics();
        }, [fetchMetrics])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchMetrics();
        setRefreshing(false);
    }, [fetchMetrics]);

    const handleGoBack = useCallback(() => {
        router.back();
    }, []);

    if (isLoading && !refreshing) {
        return (
            <ScreenContainer scroll={false} backgroundColor="#F9FAFB">
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#E5102E" />
                    <Text style={styles.loadingText}>Carregando métricas...</Text>
                </View>
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer
            scroll={false}
            backgroundColor="#F9FAFB"
            hasTabBar={false}
            hasHeader
            header={<AppHeader title="Minhas Métricas" showBackButton onPressBack={handleGoBack} />}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#E5102E']}
                        tintColor="#E5102E"
                    />
                }
            >
                {/* Summary Cards */}
                <View style={styles.cardsGrid}>
                    <View style={styles.cardsRow}>
                        <MetricsCard
                            title="Agendamentos"
                            value={metrics.appointments.total}
                            icon="calendar_check"
                            iconFamily="MaterialSymbols"
                            variant="primary"
                            subtitle="Total confirmados"
                        />
                        <MetricsCard
                            title="Faturamento"
                            value={formatCurrency(metrics.revenue.total)}
                            icon="attach_money"
                            iconFamily="MaterialSymbols"
                            variant="success"
                            subtitle="Total acumulado"
                        />
                    </View>
                    <View style={styles.cardsRow}>
                        <MetricsCard
                            title="Avaliação"
                            value={metrics.reviews.average > 0 ? metrics.reviews.average.toFixed(1) : '-'}
                            icon="star"
                            variant="warning"
                            subtitle={`${metrics.reviews.total} avaliação${metrics.reviews.total !== 1 ? 'ões' : ''}`}
                        />
                        <MetricsCard
                            title="Indicações"
                            value={metrics.referrals.length}
                            icon="group"
                            variant="info"
                            subtitle="Programa de associados"
                        />
                    </View>
                </View>

                {/* Period Filter */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Visualização por Período</Text>
                    <PeriodFilter
                        selectedPeriod={selectedPeriod}
                        onChangePeriod={changePeriod}
                    />
                </View>

                {/* Appointments Chart */}
                <MetricsChart
                    data={metrics.appointments.byPeriod}
                    type="appointments"
                    title="✓ Agendamentos"
                />

                {/* Revenue Chart */}
                <MetricsChart
                    data={metrics.revenue.byPeriod}
                    type="revenue"
                    title="$ Faturamento"
                />

                {/* Reviews Summary */}
                <ReviewSummary stats={metrics.reviews} />

                {/* Referrals List */}
                <ReferralList referrals={metrics.referrals} />

                {/* Bottom spacing */}
                <View style={styles.bottomSpacing} />
            </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontFamily: 'Montserrat_500Medium',
        fontSize: 14,
        color: '#6B7280',
        marginTop: 12,
    },
    cardsGrid: {
        marginBottom: 24,
        gap: 8,
    },
    cardsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    section: {
        marginBottom: 8,
    },
    sectionTitle: {
        fontFamily: 'Montserrat_700Bold',
        fontSize: 18,
        color: '#1F2937',
        marginBottom: 12,
    },
    bottomSpacing: {
        height: 24,
    },
});

export default MetricsScreen;
