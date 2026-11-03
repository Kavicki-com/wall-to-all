import { MockProfileStampsService } from '../lib/services/mock/mockProfileStampsService';

describe('MockProfileStampsService', () => {
  it('returns both Figma stamps earned by default, in order', async () => {
    const stamps = await new MockProfileStampsService().getStamps();
    expect(stamps).toEqual([
      { id: 'five_stars', label: '5 estrelas', earned: true },
      { id: 'full_schedule', label: 'Agenda cheia', earned: true },
    ]);
  });

  it('marks stamps outside `earned` as not earned', async () => {
    const stamps = await new MockProfileStampsService({ earned: ['five_stars'] }).getStamps();
    expect(stamps.map((s) => [s.id, s.earned])).toEqual([
      ['five_stars', true],
      ['full_schedule', false],
    ]);
  });

  it('returns defensive copies', async () => {
    const service = new MockProfileStampsService();
    const stamps = await service.getStamps();
    stamps[0].earned = false;
    stamps.pop();
    const fresh = await service.getStamps();
    expect(fresh).toHaveLength(2);
    expect(fresh[0].earned).toBe(true);
  });
});
