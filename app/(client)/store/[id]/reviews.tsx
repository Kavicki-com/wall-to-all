import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import ScreenContainer from '../../../../components/layout/ScreenContainer';
import AppHeader from '../../../../components/layout/AppHeader';
import { safeGoBack } from '../../../../lib/router-utils';
import ReviewCard from '../../../../components/reviews/ReviewCard';
import SectionTitle from '../../../../components/ui/SectionTitle';
import { logger } from '../../../../lib/logger';
import { ReviewListItem } from '../../../../lib/types';
import { colors } from '../../../../lib/theme';

type Review = ReviewListItem;

const ReviewsScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const businessId = params.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filterServiceId, setFilterServiceId] = useState<number | null>(null);

  useEffect(() => {
    if (businessId) {
      loadReviews();
    }
  }, [businessId, filterServiceId]);

  const loadReviews = async () => {
    if (!businessId) return;

    try {
      setLoading(true);

      let query = supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          client:client_id (
            full_name
          ),
          service:service_id (
            name
          )
        `)
        .eq('business_id', Number(businessId))
        .order('created_at', { ascending: false });

      if (filterServiceId) {
        query = query.eq('service_id', filterServiceId);
      }
      // Se não há filtro, mostrar todas as avaliações (do negócio e dos serviços)

      const { data, error } = await query;

      if (error) {
        logger.error('Erro ao buscar avaliações:', error);
        setReviews([]);
        return;
      }

      // Normalizar dados
      const normalizedReviews: Review[] = (data || []).map((review: any) => ({
        id: review.id,
        rating: review.rating || 0,
        comment: review.comment,
        created_at: review.created_at,
        client: Array.isArray(review.client) ? review.client[0] : review.client,
        service: Array.isArray(review.service) ? review.service[0] : review.service,
      }));

      setReviews(normalizedReviews);
    } catch (error) {
      logger.error('Erro ao carregar avaliações:', error);
      setReviews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const renderReview = ({ item }: { item: Review }) => (
    <ReviewCard
      rating={item.rating}
      comment={item.comment}
      clientName={item.client?.full_name || null}
      createdAt={item.created_at}
      serviceName={item.service?.name || null}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {filterServiceId
          ? 'Nenhuma avaliação encontrada para este serviço'
          : 'Nenhuma avaliação encontrada para este estabelecimento'}
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <ScreenContainer
        scroll={false}
        backgroundColor={colors.background}
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader
            showBackButton={true}
            onPressBack={() => safeGoBack(`/(client)/store/${businessId}`)}
          />
        }
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scroll={false}
      backgroundColor={colors.background}
      hasHeader={true}
      hasTabBar={false}
      header={
        <AppHeader
          showBackButton={true}
          onPressBack={() => safeGoBack(`/(client)/store/${businessId}`)}
        />
      }
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <SectionTitle>
            {filterServiceId ? 'Avaliações do Serviço' : 'Todas as Avaliações'}
          </SectionTitle>

          <FlatList
            data={reviews}
            renderItem={renderReview}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={true}
          />
        </View>
      </View>
    </ScreenContainer>
  );
};

export default ReviewsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

