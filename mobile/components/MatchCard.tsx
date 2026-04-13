import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import type { ProfileCard as ProfileCardType, CompatibilityBreakdown } from '@/types';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';
import Card from './ui/Card';

interface MatchCardProps {
  profile: ProfileCardType;
  compatibility: number;
  compatibilityBreakdown?: CompatibilityBreakdown;
  onPress: () => void;
  onInterest: () => void;
  onPass: () => void;
}

const BREAKDOWN_LABELS: (keyof CompatibilityBreakdown)[] = [
  'values', 'lifestyle', 'family', 'ambition', 'communication',
];

function BreakdownBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${value}%` }]} />
      </View>
      <Text style={styles.barValue}>{value}%</Text>
    </View>
  );
}

export default function MatchCard({
  profile,
  compatibility,
  compatibilityBreakdown,
  onPress,
  onInterest,
  onPass,
}: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const photoUrl = profile.photos.find((p) => p.is_primary)?.url ?? profile.photos[0]?.url;

  return (
    <Card elevated style={styles.card}>
      <View style={styles.topRow}>
        <Avatar name={fullName} photoUrl={photoUrl} size="lg" verified={profile.is_verified} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{fullName}, {profile.age}</Text>
          <Text style={styles.sub} numberOfLines={1}>{profile.city}, {profile.state}</Text>
          <Text style={styles.sub} numberOfLines={1}>{profile.occupation}</Text>
          <Text style={styles.religion}>{profile.religion} {profile.caste ? `· ${profile.caste}` : ''}</Text>
        </View>
        <Badge label={`${profile.trust_score}%`} variant="sage" size="sm" />
      </View>

      <Text style={styles.compat}>{compatibility}% Compatible</Text>

      {compatibilityBreakdown && (
        <TouchableOpacity onPress={() => setExpanded((prev) => !prev)} style={styles.expandTrigger}>
          <Text style={styles.expandText}>
            {expanded ? 'Hide' : 'Show'} Breakdown
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.gold} />
        </TouchableOpacity>
      )}

      {expanded && compatibilityBreakdown && (
        <View style={styles.breakdown}>
          {BREAKDOWN_LABELS.map((key) => (
            <BreakdownBar key={key} label={key} value={compatibilityBreakdown[key]} />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onPass}>
          <Ionicons name="close-circle-outline" size={28} color={colors.gray[500]} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.viewBtn]} onPress={onPress}>
          <Text style={styles.viewText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onInterest}>
          <Ionicons name="heart" size={28} color={colors.rose} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1 },
  name: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep },
  sub: { fontSize: fonts.sizes.sm, color: colors.gray[600] },
  religion: { fontSize: fonts.sizes.xs, color: colors.gray[500], marginTop: 2 },
  compat: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.gold, textAlign: 'center' },
  expandTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  expandText: { fontSize: fonts.sizes.sm, color: colors.gold, fontWeight: '600' },
  breakdown: { gap: spacing.xs },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 90, fontSize: fonts.sizes.xs, color: colors.gray[600], textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.gray[200], borderRadius: 3 },
  barFill: { height: 6, backgroundColor: colors.gold, borderRadius: 3 },
  barValue: { width: 32, fontSize: fonts.sizes.xs, color: colors.gray[600], textAlign: 'right' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: spacing.sm },
  actionBtn: { padding: spacing.sm },
  viewBtn: { backgroundColor: colors.rose, borderRadius: borderRadius.md, paddingHorizontal: spacing.lg },
  viewText: { color: colors.white, fontWeight: '600', fontSize: fonts.sizes.md },
});
