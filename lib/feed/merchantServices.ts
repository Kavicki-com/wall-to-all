import { supabase } from '../supabase';
import type { FeedLinkedService } from '../services/feedTypes';

interface ServiceRow {
  id: number;
  name: string;
  /** Em reais no Supabase. */
  price: number;
  duration_minutes: number;
}

/**
 * Serviços ativos da loja que podem ser vinculados a um post (F6, decisão #7:
 * vêm do Supabase real). Preço convertido para centavos. Rejeita em erro.
 */
export async function fetchLinkableServices(businessId: number): Promise<FeedLinkedService[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id,name,price,duration_minutes')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return ((data ?? []) as ServiceRow[]).map((row) => ({
    serviceId: row.id,
    name: row.name,
    priceCents: Math.round(row.price * 100),
    durationMinutes: row.duration_minutes,
  }));
}
