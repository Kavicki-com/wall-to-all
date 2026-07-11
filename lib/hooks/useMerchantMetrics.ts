import { useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../../context/AuthContext';
import { useBusinessProfile } from '../../context/BusinessProfileContext';
import { logger } from '../logger';

// Types for metrics data
export interface AppointmentsByPeriod {
    label: string;
    count: number;
    date?: string;
}

export interface RevenueByPeriod {
    label: string;
    amount: number;
    date?: string;
}

export interface ReviewStats {
    average: number;
    total: number;
    distribution: { [key: number]: number }; // 1-5 stars
}

export interface MerchantMetricsData {
    appointments: {
        total: number;
        byPeriod: AppointmentsByPeriod[];
    };
    revenue: {
        total: number;
        byPeriod: RevenueByPeriod[];
    };
    reviews: ReviewStats;
}

export type PeriodType = 'day' | 'month' | 'year';

const initialMetrics: MerchantMetricsData = {
    appointments: { total: 0, byPeriod: [] },
    revenue: { total: 0, byPeriod: [] },
    reviews: { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
};

export function useMerchantMetrics() {
    const { session } = useAuth();
    const { businessProfile } = useBusinessProfile();
    const [isLoading, setIsLoading] = useState(false);
    const [metrics, setMetrics] = useState<MerchantMetricsData>(initialMetrics);
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('month');

    // Helper to get date range based on period
    const getDateRange = useCallback((period: PeriodType) => {
        const now = new Date();
        let start: Date;
        let end = new Date(now);

        switch (period) {
            case 'day':
                // Last 30 days
                start = new Date(now);
                start.setDate(start.getDate() - 30);
                break;
            case 'month':
                // Last 12 months
                start = new Date(now);
                start.setMonth(start.getMonth() - 12);
                break;
            case 'year':
                // Last 5 years
                start = new Date(now);
                start.setFullYear(start.getFullYear() - 5);
                break;
            default:
                start = new Date(now);
                start.setMonth(start.getMonth() - 12);
        }

        return { start, end };
    }, []);

    // Fetch all metrics
    const fetchMetrics = useCallback(async (period: PeriodType = selectedPeriod) => {
        if (!session?.user?.id || !businessProfile?.id) return;

        try {
            setIsLoading(true);
            const { start, end } = getDateRange(period);

            // 1. Fetch appointments with services for revenue calculation
            const { data: appointmentsData, error: appointmentsError } = await supabase
                .from('appointments')
                .select(`
          id,
          start_time,
          status,
          service:services(price)
        `)
                .eq('business_id', businessProfile.id)
                .in('status', ['confirmed', 'completed'])
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString())
                .order('start_time', { ascending: true });

            if (appointmentsError) throw appointmentsError;

            // Process appointments by period
            const appointmentsByPeriod = processAppointmentsByPeriod(appointmentsData || [], period);
            const revenueByPeriod = processRevenueByPeriod(appointmentsData || [], period);

            // Calculate totals
            const totalAppointments = appointmentsData?.length || 0;
            const totalRevenue = (appointmentsData || []).reduce((sum, apt) => {
                const service = apt.service as unknown as { price?: number } | null;
                return sum + (service?.price || 0);
            }, 0);

            // 2. Fetch reviews
            const { data: reviewsData, error: reviewsError } = await supabase
                .from('reviews')
                .select('rating')
                .eq('business_id', businessProfile.id);

            if (reviewsError) throw reviewsError;

            const reviewStats = processReviews(reviewsData || []);

            setMetrics({
                appointments: {
                    total: totalAppointments,
                    byPeriod: appointmentsByPeriod,
                },
                revenue: {
                    total: totalRevenue,
                    byPeriod: revenueByPeriod,
                },
                reviews: reviewStats,
            });
        } catch (error) {
            logger.error('Erro ao buscar métricas:', error);
        } finally {
            setIsLoading(false);
        }
    }, [session?.user?.id, businessProfile?.id, selectedPeriod, getDateRange]);

    // Process appointments by period
    const processAppointmentsByPeriod = (
        appointments: Array<{ start_time: string }>,
        period: PeriodType
    ): AppointmentsByPeriod[] => {
        const grouped: { [key: string]: number } = {};

        appointments.forEach(apt => {
            const date = new Date(apt.start_time);
            let key: string;
            let label: string;

            switch (period) {
                case 'day':
                    key = date.toISOString().split('T')[0];
                    label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                    break;
                case 'month':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                    break;
                case 'year':
                    key = String(date.getFullYear());
                    label = key;
                    break;
                default:
                    key = date.toISOString().split('T')[0];
                    label = key;
            }

            grouped[key] = (grouped[key] || 0) + 1;
        });

        return Object.entries(grouped).map(([key, count]) => {
            const date = new Date(key + (period === 'year' ? '-01-01' : period === 'month' ? '-01' : ''));
            let label: string;
            switch (period) {
                case 'day':
                    label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                    break;
                case 'month':
                    label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                    break;
                case 'year':
                    label = key;
                    break;
                default:
                    label = key;
            }
            return { label, count, date: key };
        }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    };

    // Process revenue by period
    const processRevenueByPeriod = (
        appointments: Array<{ start_time: string; service: unknown }>,
        period: PeriodType
    ): RevenueByPeriod[] => {
        const grouped: { [key: string]: number } = {};

        appointments.forEach(apt => {
            const date = new Date(apt.start_time);
            const service = apt.service as { price?: number } | null;
            const price = service?.price || 0;
            let key: string;

            switch (period) {
                case 'day':
                    key = date.toISOString().split('T')[0];
                    break;
                case 'month':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'year':
                    key = String(date.getFullYear());
                    break;
                default:
                    key = date.toISOString().split('T')[0];
            }

            grouped[key] = (grouped[key] || 0) + price;
        });

        return Object.entries(grouped).map(([key, amount]) => {
            const date = new Date(key + (period === 'year' ? '-01-01' : period === 'month' ? '-01' : ''));
            let label: string;
            switch (period) {
                case 'day':
                    label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                    break;
                case 'month':
                    label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                    break;
                case 'year':
                    label = key;
                    break;
                default:
                    label = key;
            }
            return { label, amount, date: key };
        }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    };

    // Process reviews
    const processReviews = (reviews: Array<{ rating: number | null }>): ReviewStats => {
        if (!reviews.length) {
            return { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
        }

        const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let sum = 0;
        let count = 0;

        reviews.forEach(review => {
            if (review.rating && review.rating >= 1 && review.rating <= 5) {
                distribution[review.rating]++;
                sum += review.rating;
                count++;
            }
        });

        return {
            average: count > 0 ? sum / count : 0,
            total: count,
            distribution,
        };
    };

    // Change period and refetch
    const changePeriod = useCallback((period: PeriodType) => {
        setSelectedPeriod(period);
        fetchMetrics(period);
    }, [fetchMetrics]);

    return {
        isLoading,
        metrics,
        selectedPeriod,
        fetchMetrics,
        changePeriod,
    };
}
