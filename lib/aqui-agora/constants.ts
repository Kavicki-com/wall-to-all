import type { LatLng } from '../services/types';

/**
 * Centro do mapa das telas "Aqui e Agora": região da Av. Paulista, São Paulo.
 * Compartilhado entre a tela de mapa/busca e o perfil do lojista para carregar
 * os merchants próximos (`getNearbyMerchants`) a partir do mesmo ponto.
 */
export const SP_CENTER: LatLng = { latitude: -23.5505, longitude: -46.6333 };
