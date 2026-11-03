import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ProfileStamp } from '../../lib/services/profileTypes';
import { STAMP_ART } from './stampArt';

/** Lado do selo no perfil (instâncias 64 x 64 do profile-view `2611:6893`). */
const STAMP_SIZE = 64;

interface ProfileStampsRowProps {
  stamps: ProfileStamp[];
}

/**
 * Fileira de selos do perfil do lojista (F7). Selo conquistado usa a arte
 * colorida; não conquistado, a cinza. Lista vazia não renderiza nada.
 */
const ProfileStampsRow: React.FC<ProfileStampsRowProps> = ({ stamps }) => {
  if (stamps.length === 0) return null;

  return (
    <View style={styles.row}>
      {stamps.map((stamp) => {
        const art = STAMP_ART[stamp.id];
        const Art = stamp.earned ? art.active : art.disabled;
        const height = STAMP_SIZE * art.aspect;
        return (
          <View
            key={stamp.id}
            testID={`stamp-${stamp.id}-${stamp.earned ? 'active' : 'disabled'}`}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Selo ${stamp.label}, ${stamp.earned ? 'conquistado' : 'não conquistado'}`}
            style={styles.stamp}
          >
            {/* Alinhado pela base: as estrelas do selo de 5 estrelas passam do quadro, como no Figma. */}
            <View style={[styles.art, { height }]}>
              <Art width={STAMP_SIZE} height={height} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  stamp: {
    width: STAMP_SIZE,
    height: STAMP_SIZE,
    overflow: 'visible',
  },
  art: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: STAMP_SIZE,
  },
});

export default ProfileStampsRow;
