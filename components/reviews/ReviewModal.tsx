import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { CustomButton } from '../CustomButton';
import { CustomInput } from '../ui/CustomInput';
import { Icon } from '../ui/Icon';
import { IconRatingStar, IconKidStar } from '../../lib/icons';
import { useReviewPermissions } from '../../lib/hooks/useReviewPermissions';
import { isValidRating, isValidComment } from '../../lib/utils/reviewUtils';
import { logger } from '../../lib/logger';
import SelectDropdown from '../ui/SelectDropdown';

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  businessId: string | number;
  clientId: string | null;
  onReviewSubmitted?: () => void;
}

type ReviewType = 'business' | 'service';

interface ServiceOption {
  id: number;
  name: string;
  appointment_id: number;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  visible,
  onClose,
  businessId,
  clientId,
  onReviewSubmitted,
}) => {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/reviews/ReviewModal.tsx:27',message:'ReviewModal rendering',data:{visible,businessId,businessIdType:typeof businessId,clientId,hasClientId:!!clientId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [reviewType, setReviewType] = useState<ReviewType>('business');
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>({});

  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/reviews/ReviewModal.tsx:51',message:'Before useReviewPermissions call',data:{businessId,businessIdType:typeof businessId,clientId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const permissions = useReviewPermissions(
    typeof businessId === 'string' ? Number(businessId) : businessId,
    clientId
  );
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/reviews/ReviewModal.tsx:55',message:'After useReviewPermissions call',data:{isLoading:permissions.isLoading,canReviewBusiness:permissions.canReviewBusiness},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  const loadExistingReview = useCallback(async (reviewId: number | null) => {
    if (!reviewId) return;

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating, comment')
        .eq('id', reviewId)
        .single();

      if (error) {
        logger.error('Erro ao carregar avaliação existente:', error);
        return;
      }

      if (data) {
        setRating(data.rating);
        setComment(data.comment || '');
      }
    } catch (error) {
      logger.error('Erro ao carregar avaliação existente:', error);
    }
  }, []);

  const handleStarPress = (starValue: number) => {
    setRating(starValue);
    if (errors.rating) {
      setErrors((prev) => ({ ...prev, rating: undefined }));
    }
  };

  const handleSubmit = async () => {
    // Validação
    const newErrors: { rating?: string; comment?: string } = {};

    if (!isValidRating(rating)) {
      newErrors.rating = 'Por favor, selecione uma avaliação de 1 a 5 estrelas';
    }

    if (!isValidComment(comment, 500)) {
      newErrors.comment = 'O comentário deve ter no máximo 500 caracteres';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!clientId) {
      Alert.alert('Erro', 'Você precisa estar autenticado para avaliar');
      return;
    }

    setIsSubmitting(true);

    try {
      const reviewData: {
        business_id: number;
        client_id: string;
        rating: number;
        comment?: string | null;
        service_id?: number | null;
        appointment_id?: number | null;
      } = {
        business_id: Number(businessId),
        client_id: clientId,
        rating: rating!,
        comment: comment.trim() || null,
      };

      if (reviewType === 'service' && selectedService) {
        reviewData.service_id = selectedService.id;
        reviewData.appointment_id = selectedService.appointment_id;
      }

      // Verificar se já existe avaliação para editar
      let existingReviewId: number | null = null;

      if (reviewType === 'business') {
        existingReviewId = permissions.existingBusinessReviewId;
      } else if (reviewType === 'service' && selectedService) {
        existingReviewId = permissions.existingServiceReviews[selectedService.id] || null;
      }

      if (existingReviewId) {
        // Atualizar avaliação existente
        const { error: updateError } = await supabase
          .from('reviews')
          .update({
            rating: reviewData.rating,
            comment: reviewData.comment,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingReviewId);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Criar nova avaliação
        const { error: insertError } = await supabase.from('reviews').insert(reviewData);

        if (insertError) {
          throw insertError;
        }
      }

      // Sucesso
      Alert.alert('Sucesso', 'Avaliação enviada com sucesso!', [
        {
          text: 'OK',
          onPress: () => {
            onClose();
            if (onReviewSubmitted) {
              onReviewSubmitted();
            }
          },
        },
      ]);
    } catch (error) {
      logger.error('Erro ao enviar avaliação:', error);
      Alert.alert('Erro', 'Não foi possível enviar a avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resetar estado quando modal abre/fecha
  useEffect(() => {
    if (visible) {
      setRating(null);
      setComment('');
      setReviewType('business');
      setSelectedService(null);
      setErrors({});
    }
  }, [visible]);

  // Preencher dados se já existe avaliação
  useEffect(() => {
    if (!visible || permissions.isLoading) return;

    if (reviewType === 'business' && permissions.hasExistingBusinessReview) {
      // Carregar avaliação existente do negócio
      loadExistingReview(permissions.existingBusinessReviewId);
    } else if (
      reviewType === 'service' &&
      selectedService &&
      permissions.existingServiceReviews[selectedService.id]
    ) {
      // Carregar avaliação existente do serviço
      loadExistingReview(permissions.existingServiceReviews[selectedService.id]);
    }
    // Se não há avaliação existente, os valores já foram resetados no useEffect anterior
  }, [visible, permissions.isLoading, permissions.hasExistingBusinessReview, permissions.existingBusinessReviewId, permissions.existingServiceReviews, reviewType, selectedService, loadExistingReview]);

  const serviceOptions: ServiceOption[] = permissions.completedAppointments.map((apt) => ({
    id: apt.service_id,
    name: apt.service_name,
    appointment_id: apt.id,
  }));

  const canReviewBusiness = permissions.canReviewBusiness;
  const canReviewServices = permissions.canReviewServices;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.title}>Avaliar</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Icon name="close" family="MaterialSymbols" size={24} color="#0F0F0F" />
                  </TouchableOpacity>
                </View>

                {/* Tipo de Avaliação */}
                {canReviewBusiness && canReviewServices && (
                  <View style={styles.reviewTypeContainer}>
                    <TouchableOpacity
                      style={[
                        styles.reviewTypeButton,
                        reviewType === 'business' && styles.reviewTypeButtonActive,
                      ]}
                      onPress={() => {
                        setReviewType('business');
                        setSelectedService(null);
                        setRating(null);
                        setComment('');
                        setErrors({});
                      }}
                    >
                      <Text
                        style={[
                          styles.reviewTypeText,
                          reviewType === 'business' && styles.reviewTypeTextActive,
                        ]}
                      >
                        Estabelecimento
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.reviewTypeButton,
                        reviewType === 'service' && styles.reviewTypeButtonActive,
                      ]}
                      onPress={() => {
                        setReviewType('service');
                        setRating(null);
                        setComment('');
                        setErrors({});
                      }}
                    >
                      <Text
                        style={[
                          styles.reviewTypeText,
                          reviewType === 'service' && styles.reviewTypeTextActive,
                        ]}
                      >
                        Serviço
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Seleção de Serviço (se avaliando serviço) */}
                {reviewType === 'service' && canReviewServices && (
                  <View style={styles.serviceSelectContainer}>
                    <Text style={styles.label}>Selecione o serviço</Text>
                    <SelectDropdown<ServiceOption>
                      data={serviceOptions}
                      labelKey="name"
                      valueKey="id"
                      placeholder="Escolha um serviço"
                      selectedValue={selectedService}
                      onSelect={setSelectedService}
                    />
                  </View>
                )}

                {/* Seleção de Estrelas */}
                <View style={styles.ratingContainer}>
                  <Text style={styles.label}>
                    Sua avaliação {errors.rating && <Text style={styles.errorText}>*</Text>}
                  </Text>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((starValue) => (
                      <TouchableOpacity
                        key={starValue}
                        onPress={() => handleStarPress(starValue)}
                        style={styles.starButton}
                        accessibilityLabel={`${starValue} estrela${starValue > 1 ? 's' : ''}`}
                        accessibilityRole="button"
                      >
                        {rating && starValue <= rating ? (
                          <IconRatingStar size={40} color="#FFB800" />
                        ) : (
                          <IconKidStar size={40} color="#DBDBDB" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                  {errors.rating && (
                    <Text style={styles.errorText}>{errors.rating}</Text>
                  )}
                </View>

                {/* Campo de Comentário */}
                <View style={styles.commentContainer}>
                  <CustomInput
                    label="Comentário (opcional)"
                    value={comment}
                    onChangeText={(text) => {
                      setComment(text);
                      if (errors.comment) {
                        setErrors((prev) => ({ ...prev, comment: undefined }));
                      }
                    }}
                    placeholder="Deixe um comentário sobre sua experiência..."
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                    error={errors.comment}
                    helperText={`${comment.length}/500 caracteres`}
                    containerStyle={styles.commentInput}
                  />
                </View>

                {/* Botão de Enviar */}
                <CustomButton
                  title={
                    (reviewType === 'business' && permissions.hasExistingBusinessReview) ||
                    (reviewType === 'service' &&
                      selectedService &&
                      permissions.existingServiceReviews[selectedService.id])
                      ? 'Atualizar Avaliação'
                      : 'Enviar Avaliação'
                  }
                  variant="primary"
                  onPress={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={
                    isSubmitting ||
                    !rating ||
                    (reviewType === 'service' && !selectedService)
                  }
                  style={styles.submitButton}
                />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default ReviewModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  closeButton: {
    padding: 4,
  },
  reviewTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  reviewTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#474747',
    backgroundColor: '#FEFEFE',
    alignItems: 'center',
  },
  reviewTypeButtonActive: {
    borderColor: '#000E3D',
    backgroundColor: '#000E3D',
  },
  reviewTypeText: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  reviewTypeTextActive: {
    color: '#FEFEFE',
  },
  serviceSelectContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#000E3D',
    marginBottom: 4,
  },
  ratingContainer: {
    marginBottom: 24,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  starButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#E5102E',
    marginTop: 4,
  },
  commentContainer: {
    marginBottom: 24,
  },
  commentInput: {
    marginBottom: 0,
  },
  submitButton: {
    marginTop: 8,
  },
});

