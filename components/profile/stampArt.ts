import type React from 'react';
import type { SvgProps } from 'react-native-svg';
import type { ProfileStampId } from '../../lib/services/profileTypes';
import FiveStarsActive from '../../assets/stamps/five-stars-active.svg';
import FiveStarsDisabled from '../../assets/stamps/five-stars-disabled.svg';
import FullScheduleActive from '../../assets/stamps/full-schedule-active.svg';
import FullScheduleDisabled from '../../assets/stamps/full-schedule-disabled.svg';

/**
 * Arte dos selos (profile-stamps `2625:5970`). SVG em vez de PNG porque o export
 * PNG do Figma sai com o fundo do canvas opaco; os SVGs foram limpos do fundo e
 * da borda do component set. Módulo separado para os testes trocarem a arte
 * com um único `jest.mock` (o jest-expo trata `.svg` como asset).
 *
 * `aspect` = altura / largura: o selo de 5 estrelas tem as estrelas acima do
 * hexágono (148 x 158), o de agenda é quadrado.
 */
export const STAMP_ART: Record<
  ProfileStampId,
  { active: React.FC<SvgProps>; disabled: React.FC<SvgProps>; aspect: number }
> = {
  five_stars: { active: FiveStarsActive, disabled: FiveStarsDisabled, aspect: 158 / 148 },
  full_schedule: { active: FullScheduleActive, disabled: FullScheduleDisabled, aspect: 1 },
};
