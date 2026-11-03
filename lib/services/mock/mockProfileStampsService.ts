import type { ProfileStamp, ProfileStampId, ProfileStampsService } from '../profileTypes';

/** Latência simulada (ms) para o app real; default 0 nos testes (ver outros mocks). */
export const SIMULATED_LATENCY_MS = 300;

export interface MockProfileStampsServiceOptions {
  latencyMs?: number;
  /** Selos conquistados. Default: todos, como no Figma. */
  earned?: ProfileStampId[];
}

const STAMPS: ReadonlyArray<Omit<ProfileStamp, 'earned'>> = [
  { id: 'five_stars', label: '5 estrelas' },
  { id: 'full_schedule', label: 'Agenda cheia' },
];

/** Selos fixos do perfil do lojista (decisão da F7: mock até existir regra real). */
export class MockProfileStampsService implements ProfileStampsService {
  private readonly latencyMs: number;
  private readonly earned: Set<ProfileStampId>;

  constructor(options: MockProfileStampsServiceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.earned = new Set(options.earned ?? STAMPS.map((stamp) => stamp.id));
  }

  async getStamps(): Promise<ProfileStamp[]> {
    await this.delay();
    return STAMPS.map((stamp) => ({ ...stamp, earned: this.earned.has(stamp.id) }));
  }

  private async delay(): Promise<void> {
    if (this.latencyMs === 0) {
      await Promise.resolve();
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
