import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import type { ProfileCard as ProfileCardType } from '@/types';
import Avatar from './ui/Avatar';
import Card from './ui/Card';

interface ProfileCardProps {
  profile: ProfileCardType;
  onPress: () => void;
  onLike?: () => void;
  isLiked?: boolean;
  compatibility?: number;
}

export default function ProfileCard({
  profile,
  onPress,
  onLike,
  isLiked = false,
  compatibility,
}: ProfileCardProps) {
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const photoUrl = profile.photos.find((p) => p.is_primary)?.url ?? profile.photos[0]?.url;

  return (
    <Card onPress={onPress} elevated style={styles.card}>
      {onLike && (
        <TouchableOpacity style={styles.heart} onPress={onLike} hitSlop={8}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={22}
            color={isLiked ? colors.rose : colors.gray[400]}
          />
        </TouchableOpacity>
      )}

      <View style={styles.center}>
        <Avatar name={fullName} photoUrl={photoUrl} size="md" verified={profile.is_verified} />
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {profile.first_name}, {profile.age}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>{profile.city}</Text>
      <Text style={styles.sub} numberOfLines={1}>{profile.occupation}</Text>

      {compatibility !== undefined && (
        <Text style={styles.compat}>{compatibility}%</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    position: 'relative',
  },
  heart: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
  },
  center: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: fonts.sizes.md,
    fontWeight: '700',
    color: colors.deep,
    textAlign: 'center',
  },
  sub: {
    fontSize: fonts.sizes.sm,
    color: colors.gray[600],
    textAlign: 'center',
  },
  compat: {
    fontSize: fonts.sizes.sm,
    fontWeight: '700',
    color: colors.gold,
    marginTop: spacing.xs,
  },
});
