import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { logger } from '../logger';

export interface ReviewPermissions {
  canReviewBusiness: boolean;
  canReviewServices: boolean;
  hasExistingBusinessReview: boolean;
  completedAppointments: Array<{
    id: number;
    service_id: number;
    service_name: string;
  }>;
  existingServiceReviews: Record<number, number>; // service_id -> review_id
  existingBusinessReviewId: number | null;
  isLoading: boolean;
}

/**
 * Hook para verificar permissões de avaliação do cliente
 * - Qualquer cliente autenticado pode avaliar o negócio
 * - Apenas clientes com agendamentos completos podem avaliar serviços
 */
export const useReviewPermissions = (
  businessId: number | null,
  clientId: string | null
): ReviewPermissions => {
  const [permissions, setPermissions] = useState<ReviewPermissions>({
    canReviewBusiness: false,
    canReviewServices: false,
    hasExistingBusinessReview: false,
    completedAppointments: [],
    existingServiceReviews: {},
    existingBusinessReviewId: null,
    isLoading: true,
  });

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/useReviewPermissions.ts:38',message:'useReviewPermissions useEffect triggered',data:{businessId,businessIdType:typeof businessId,clientId,hasBusinessId:!!businessId,hasClientId:!!clientId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!businessId || !clientId) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/useReviewPermissions.ts:40',message:'Early return - missing businessId or clientId',data:{businessId,clientId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setPermissions((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    const loadPermissions = async () => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/useReviewPermissions.ts:46',message:'loadPermissions started',data:{businessId,businessIdType:typeof businessId,clientId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        // Verificar se cliente pode avaliar negócio (sempre pode se autenticado)
        setPermissions((prev) => ({ ...prev, canReviewBusiness: true }));

        // Buscar agendamentos completos do cliente para este negócio
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/useReviewPermissions.ts:50',message:'Before appointments query',data:{businessId,businessIdType:typeof businessId,clientId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const { data: appointments, error: appointmentsError } = await supabase
          .from('appointments')
          .select(`
            id,
            service_id,
            services:service_id (
              id,
              name
            )
          `)
          .eq('client_id', clientId)
          .eq('business_id', businessId)
          .eq('status', 'completed');
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/useReviewPermissions.ts:63',message:'After appointments query',data:{hasError:!!appointmentsError,error:appointmentsError?.message,appointmentsCount:appointments?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        if (appointmentsError) {
          logger.error('Erro ao buscar agendamentos para avaliação:', appointmentsError);
        }

        // Normalizar dados dos agendamentos
        const completedAppointments =
          appointments?.map((apt: any) => {
            const service = Array.isArray(apt.services) ? apt.services[0] : apt.services;
            return {
              id: apt.id,
              service_id: apt.service_id,
              service_name: service?.name || 'Serviço',
            };
          }) || [];

        // Verificar se cliente pode avaliar serviços (tem agendamentos completos)
        const canReviewServices = completedAppointments.length > 0;

        // Buscar avaliações existentes do cliente para este negócio
        const { data: businessReview, error: businessReviewError } = await supabase
          .from('reviews')
          .select('id')
          .eq('client_id', clientId)
          .eq('business_id', businessId)
          .is('service_id', null)
          .maybeSingle();

        if (businessReviewError && businessReviewError.code !== 'PGRST116') {
          logger.error('Erro ao buscar avaliação do negócio:', businessReviewError);
        }

        // Buscar avaliações existentes de serviços
        const serviceIds = completedAppointments.map((apt) => apt.service_id);
        let existingServiceReviews: Record<number, number> = {};

        if (serviceIds.length > 0) {
          const { data: serviceReviews, error: serviceReviewsError } = await supabase
            .from('reviews')
            .select('id, service_id')
            .eq('client_id', clientId)
            .eq('business_id', businessId)
            .in('service_id', serviceIds);

          if (serviceReviewsError) {
            logger.error('Erro ao buscar avaliações de serviços:', serviceReviewsError);
          } else if (serviceReviews) {
            serviceReviews.forEach((review) => {
              if (review.service_id) {
                existingServiceReviews[review.service_id] = review.id;
              }
            });
          }
        }

        setPermissions({
          canReviewBusiness: true,
          canReviewServices,
          hasExistingBusinessReview: !!businessReview,
          completedAppointments,
          existingServiceReviews,
          existingBusinessReviewId: businessReview?.id || null,
          isLoading: false,
        });
      } catch (error) {
        logger.error('Erro ao carregar permissões de avaliação:', error);
        setPermissions((prev) => ({ ...prev, isLoading: false }));
      }
    };

    loadPermissions();
  }, [businessId, clientId]);

  return permissions;
};

