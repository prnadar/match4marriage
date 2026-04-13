import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@/lib/theme';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: AvatarSize;
  verified?: boolean;
}

const DIMENSION: Record<AvatarSize, number> = { sm: 36, md: 48, lg: 72, xl: 96 };
const FONT: Record<AvatarSize, number> = { sm: fonts.sizes.xs, md: fonts.sizes.md, lg: fonts.sizes.xl, xl: fonts.sizes['3xl'] };
const BADGE: Record<AvatarSize, number> = { sm: 14, md: 16, lg: 22, xl: 28 };

const GRADIENT_PALETTE = [
  '#E8426A', '#C9954A', '#5C7A52', '#2196F3',
  '#9C27B0', '#FF8FA3', '#00897B', '#D81B60',
] as const;

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

export default function Avatar({ name, photoUrl, size = 'md', verified = false }: AvatarProps) {
  const dim = DIMENSION[size];
  const bg = GRADIENT_PALETTE[hashName(name) % GRADIENT_PALETTE.length];
  const badgeDim = BADGE[size];

  return (
    <View style={[styles.wrapper, { width: dim, height: dim }]}>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={[styles.image, { width: dim, height: dim, borderRadius: dim / 2 }]}
        />
      ) : (
        <View style={[styles.fallback, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg }]}>
          <Text style={[styles.initials, { fontSize: FONT[size] }]}>{getInitials(name)}</Text>
        </View>
      )}
      {verified && (
        <View
          style={[
            styles.badge,
            {
              width: badgeDim,
              height: badgeDim,
              borderRadius: badgeDim / 2,
              bottom: 0,
              right: 0,
            },
          ]}
        >
          <Ionicons name="checkmark" size={badgeDim * 0.6} color={colors.white} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.white,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
});
