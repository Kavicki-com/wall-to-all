/**
 * Selos do perfil do lojista (F7, profile-stamps `2625:5970`). Domínio próprio,
 * fora de `types.ts`. Hoje é um mock fixo; a regra real de conquista (ex.: média
 * 5 estrelas, agenda lotada) fica para quando houver backend.
 */
export type ProfileStampId = 'five_stars' | 'full_schedule';

export interface ProfileStamp {
  id: ProfileStampId;
  /** Rótulo para acessibilidade ("5 estrelas", "Agenda cheia"). */
  label: string;
  earned: boolean;
}

export interface ProfileStampsService {
  /** Todos os selos, na ordem de exibição, conquistados ou não. */
  getStamps(): Promise<ProfileStamp[]>;
}
