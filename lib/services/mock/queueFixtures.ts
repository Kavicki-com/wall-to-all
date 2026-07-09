import type { NearbyMerchant, QueueSettings, QueueTicket } from '../types';

/**
 * Merchant cuja fila é simulada "ao vivo" pelo MockQueueService (o lado
 * lojista do mock opera sobre esta fila). Os demais merchants têm QueueInfo
 * estático, apenas para popular o mapa/lista.
 */
export const LIVE_MERCHANT_ID = 'm1';

export const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
  furaFilaEnabled: true,
  furaFilaPriceCents: 1500,
  maxSize: 30,
  avgServiceMinutes: 10,
  visibilityRadiusKm: 3,
  autoCloseMinutes: 120,
};

/** ~6 merchants em São Paulo, categorias variadas e filas em estados diversos. */
export const FIXTURE_MERCHANTS: NearbyMerchant[] = [
  {
    id: 'm1',
    name: 'Barbearia do Zé',
    category: 'Barbearia',
    coordinate: { latitude: -23.5614, longitude: -46.656 },
    distanceKm: 0,
    rating: 4.8,
    queue: {
      merchantId: 'm1',
      merchantName: 'Barbearia do Zé',
      status: 'active',
      ticketsWaiting: 5,
      estimatedWaitMinutes: 50,
      nowServingNumber: null,
      settings: { ...DEFAULT_QUEUE_SETTINGS },
    },
  },
  {
    id: 'm2',
    name: 'Salão Bella Vista',
    category: 'Salão de beleza',
    coordinate: { latitude: -23.5587, longitude: -46.6603 },
    distanceKm: 0,
    rating: 4.6,
    queue: {
      merchantId: 'm2',
      merchantName: 'Salão Bella Vista',
      status: 'active',
      ticketsWaiting: 3,
      estimatedWaitMinutes: 75,
      nowServingNumber: 12,
      settings: {
        furaFilaEnabled: true,
        furaFilaPriceCents: 2000,
        maxSize: 20,
        avgServiceMinutes: 25,
        visibilityRadiusKm: 5,
        autoCloseMinutes: 60,
      },
    },
  },
  {
    id: 'm3',
    name: 'Café Aurora',
    category: 'Cafeteria',
    coordinate: { latitude: -23.5629, longitude: -46.6544 },
    distanceKm: 0,
    rating: 4.9,
    queue: {
      merchantId: 'm3',
      merchantName: 'Café Aurora',
      status: 'full',
      ticketsWaiting: 12,
      estimatedWaitMinutes: 60,
      nowServingNumber: 33,
      settings: {
        furaFilaEnabled: false,
        furaFilaPriceCents: 0,
        maxSize: 12,
        avgServiceMinutes: 5,
        visibilityRadiusKm: 1,
        autoCloseMinutes: null,
      },
    },
  },
  {
    id: 'm4',
    name: 'Restaurante Sabor da Vila',
    category: 'Restaurante',
    coordinate: { latitude: -23.5648, longitude: -46.6512 },
    distanceKm: 0,
    rating: 4.4,
    queue: {
      merchantId: 'm4',
      merchantName: 'Restaurante Sabor da Vila',
      status: 'active',
      ticketsWaiting: 8,
      estimatedWaitMinutes: 96,
      nowServingNumber: 21,
      settings: {
        furaFilaEnabled: true,
        furaFilaPriceCents: 2500,
        maxSize: 40,
        avgServiceMinutes: 12,
        visibilityRadiusKm: 5,
        autoCloseMinutes: 180,
      },
    },
  },
  {
    id: 'm5',
    name: 'Pet Shop Amigo Fiel',
    category: 'Pet shop',
    coordinate: { latitude: -23.557, longitude: -46.6485 },
    distanceKm: 0,
    rating: 4.2,
    queue: {
      merchantId: 'm5',
      merchantName: 'Pet Shop Amigo Fiel',
      status: 'inactive',
      ticketsWaiting: 0,
      estimatedWaitMinutes: 0,
      nowServingNumber: null,
      settings: {
        furaFilaEnabled: false,
        furaFilaPriceCents: 0,
        maxSize: 15,
        avgServiceMinutes: 20,
        visibilityRadiusKm: 3,
        autoCloseMinutes: 120,
      },
    },
  },
  {
    id: 'm6',
    name: 'Clínica OdontoPrime',
    category: 'Clínica',
    coordinate: { latitude: -23.5525, longitude: -46.6577 },
    distanceKm: 0,
    rating: 4.7,
    queue: {
      merchantId: 'm6',
      merchantName: 'Clínica OdontoPrime',
      status: 'paused',
      ticketsWaiting: 4,
      estimatedWaitMinutes: 120,
      nowServingNumber: 7,
      settings: {
        furaFilaEnabled: true,
        furaFilaPriceCents: 3000,
        maxSize: 25,
        avgServiceMinutes: 30,
        visibilityRadiusKm: 10,
        autoCloseMinutes: 120,
      },
    },
  },
];

/**
 * Fila interna pré-populada do merchant "ao vivo" (m1): 5 tickets waiting,
 * posições 1..5 (0 = sendo atendido). estimatedWaitMinutes = posição × 10min.
 */
export const FIXTURE_TICKETS: QueueTicket[] = [
  {
    id: 't1',
    number: 41,
    customerName: 'Ana Souza',
    joinedAt: '2026-07-08T12:10:00.000Z',
    isFuraFila: false,
    status: 'waiting',
    positionInLine: 1,
    estimatedWaitMinutes: 10,
  },
  {
    id: 't2',
    number: 42,
    customerName: 'Bruno Lima',
    joinedAt: '2026-07-08T12:25:00.000Z',
    isFuraFila: true,
    status: 'waiting',
    positionInLine: 2,
    estimatedWaitMinutes: 20,
  },
  {
    id: 't3',
    number: 43,
    customerName: 'Carla Menezes',
    joinedAt: '2026-07-08T12:18:00.000Z',
    isFuraFila: false,
    status: 'waiting',
    positionInLine: 3,
    estimatedWaitMinutes: 30,
  },
  {
    id: 't4',
    number: 44,
    customerName: 'Diego Ramos',
    joinedAt: '2026-07-08T12:32:00.000Z',
    isFuraFila: false,
    status: 'waiting',
    positionInLine: 4,
    estimatedWaitMinutes: 40,
  },
  {
    id: 't5',
    number: 45,
    customerName: 'Elisa Prado',
    joinedAt: '2026-07-08T12:40:00.000Z',
    isFuraFila: false,
    status: 'waiting',
    positionInLine: 5,
    estimatedWaitMinutes: 50,
  },
];
