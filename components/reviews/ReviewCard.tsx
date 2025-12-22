import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconRatingStar, IconKidStar } from '../../lib/icons';
import SurfaceCard from '../ui/SurfaceCard';
import { formatReviewDate } from '../../lib/utils/reviewUtils';

interface ReviewCardProps {
  rating: number;
  comment: string | null;
  clientName: string | null;
  createdAt: string | null;
  serviceName?: string | null;
}

const ReviewCard: React.FC<ReviewCardProps> = ({
  rating,
  comment,
  clientName,
  createdAt,
  serviceName,
}) => {
  const displayName = clientName || 'Cliente';
  const formattedDate = formatReviewDate(createdAt || null);

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.clientName}>{displayName}</Text>
          {serviceName && (
            <Text style={styles.serviceName}>• {serviceName}</Text>
          )}
        </View>
        <Text style={styles.date}>{formattedDate}</Text>
      </View>

      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((starValue) => (
          starValue <= rating ? (
            <IconRatingStar key={starValue} size={16} color="#FFB800" />
          ) : (
            <IconKidStar key={starValue} size={16} color="#DBDBDB" />
          )
        ))}
      </View>

      {comment && (
        <Text style={styles.comment}>{comment}</Text>
      )}
    </SurfaceCard>
  );
};

export default ReviewCard;

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  clientName: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#0F0F0F',
  },
  serviceName: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    marginLeft: 4,
  },
  date: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  comment: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    lineHeight: 20,
    marginTop: 4,
  },
});

