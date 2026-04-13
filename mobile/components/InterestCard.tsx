import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '@/lib/theme';
import type { Interest } from '@/types';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';
import Card from './ui/Card';

interface InterestCardProps {
  interest: Interest;
  onAccept?: () => void;
  onDecline?: () => void;
  type: 'received' | 'sent';
  compatibility?: number;
}

const STATUS_VARIANT = {
  pending: 'gold',
  accepted: 'sage',
  declined: 'error',
  withdrawn: 'gray',
} as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function InterestCard({
  interest,
  onAccept,
  onDecline,
  type,
  compatibility,
}: InterestCardProps) {
  const profile = type === 'received' ? interest.sender_profile : interest.receiver_profile;
  if (!profile) return null;

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const photoUrl = profile.photos.find((p) => p.is_primary)?.url ?? profile.photos[0]?.url;

  return (
    <Card elevated style={styles.card}>
      <View style={styles.row}>
        <Avatar name={fullName} photoUrl={photoUrl} size="md" verified={profile.is_verified} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
          <Text style={styles.sub} numberOfLines={1}>{profile.occupation}</Text>
          <View style={styles.meta}>
            {compatibility !== undefined && (
              <Text style={styles.compat}>{compatibility}%</Text>
            )}
            <Text style={styles.time}>{timeAgo(interest.created_at)}</Text>
          </View>
        </View>
      </View>

      {interest.message ? (
        <Text style={styles.message} numberOfLines={2}>{interest.message}</Text>
      ) : null}

      {type === 'received' ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
            <Ionicons name="close" size={22} color={colors.gray[600]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
            <Ionicons name="heart" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.statusRow}>
          <Badge
            label={interest.status.charAt(0).toUpperCase() + interest.status.slice(1)}
            variant={STATUS_VARIANT[interest.status]}
            size="sm"
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1 },
  name: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.deep },
  sub: { fontSize: fonts.sizes.sm, color: colors.gray[600] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  compat: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.gold },
  time: { fontSize: fonts.sizes.xs, color: colors.gray[500] },
  message: { fontSize: fonts.sizes.sm, color: colors.gray[700], fontStyle: 'italic' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  declineBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.gray[200],
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.rose,
    alignItems: 'center', justifyContent: 'center',
  },
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end' },
});
