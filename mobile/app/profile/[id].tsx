import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import { useProfile } from '@/hooks/useApi';
import { useSendInterest } from '@/hooks/useApi';
import { getMockProfile, isMockId } from '@/lib/mockProfiles';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import type { CompatibilityBreakdown } from '@/types';

const COMPAT_DIMENSIONS: { key: keyof CompatibilityBreakdown; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'values', label: 'Values', icon: 'heart' },
  { key: 'lifestyle', label: 'Lifestyle', icon: 'leaf' },
  { key: 'family', label: 'Family', icon: 'people' },
  { key: 'ambition', label: 'Ambition', icon: 'rocket' },
  { key: 'communication', label: 'Communication', icon: 'chatbubbles' },
];

const MOCK_COMPAT: CompatibilityBreakdown = {
  values: 85,
  lifestyle: 72,
  family: 90,
  ambition: 78,
  communication: 65,
};

function formatHeight(cm: number | null): string {
  if (!cm) return 'N/A';
  const feet = Math.floor(cm / 30.48);
  const inches = Math.round((cm % 30.48) / 2.54);
  return `${feet}'${inches}" (${cm} cm)`;
}

function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function ProfileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isMock = id ? isMockId(id) : false;
  const mockProfile = id && isMock ? getMockProfile(id) : null;
  const { data: apiProfile, isLoading, error } = useProfile(isMock ? null : (id ?? null));
  const profile = mockProfile ?? apiProfile;
  const sendInterest = useSendInterest();

  const overallCompat = Math.round(
    Object.values(MOCK_COMPAT).reduce((a, b) => a + b, 0) / COMPAT_DIMENSIONS.length
  );

  const primaryPhoto = profile?.photos?.find((p) => p.is_primary)?.url ?? null;
  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : '';

  const handleSendInterest = () => {
    if (!id) return;
    sendInterest.mutate({ receiverId: id });
  };

  const handleSuperLike = () => {
    if (!id) return;
    sendInterest.mutate({ receiverId: id, isSuperInterest: true });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.rose} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={48} color={colors.gray[400]} />
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.deep} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          {primaryPhoto ? (
            <Image source={{ uri: primaryPhoto }} style={styles.largePhoto} />
          ) : (
            <Avatar name={fullName} size="xl" />
          )}
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.subtitle}>
            {profile.city ?? 'Unknown'}{profile.state ? `, ${profile.state}` : ''}
          </Text>
          <View style={styles.badgeRow}>
            <Badge label={`Trust: ${profile.completeness_score}%`} variant="sage" size="sm" />
            {profile.is_manglik !== null && (
              <Badge label={profile.is_manglik ? 'Manglik' : 'Non-Manglik'} variant="gray" size="sm" />
            )}
          </View>
        </View>

        {/* Compatibility */}
        <Section title="Compatibility">
          <View style={styles.compatHeader}>
            <Text style={styles.compatScore}>{overallCompat}%</Text>
            <Text style={styles.compatLabel}>Overall Match</Text>
          </View>
          {COMPAT_DIMENSIONS.map((dim) => (
            <View key={dim.key} style={styles.compatRow}>
              <Ionicons name={dim.icon} size={16} color={colors.rose} />
              <Text style={styles.compatDimLabel}>{dim.label}</Text>
              <View style={styles.compatBarWrap}>
                <ProgressBar value={MOCK_COMPAT[dim.key]} />
              </View>
              <Text style={styles.compatPct}>{MOCK_COMPAT[dim.key]}%</Text>
            </View>
          ))}
        </Section>

        {/* About */}
        {profile.bio ? (
          <Section title="About">
            <Text style={styles.bioText}>{profile.bio}</Text>
          </Section>
        ) : null}

        {/* Basic Info */}
        <Section title="Basic Info">
          <InfoRow label="Religion" value={profile.religion} />
          <InfoRow label="Caste" value={profile.caste} />
          <InfoRow label="Mother Tongue" value={profile.mother_tongue} />
          <InfoRow label="Height" value={formatHeight(profile.height_cm)} />
          <InfoRow label="Marital Status" value={(profile.marital_status ?? '').replace('_', ' ')} />
        </Section>

        {/* Education & Career */}
        <Section title="Education & Career">
          <InfoRow label="Education" value={[profile.education_level, profile.education_field].filter(Boolean).join(' - ') || 'N/A'} />
          <InfoRow label="College" value={(profile as any).college ?? ''} />
          <InfoRow label="Occupation" value={profile.occupation} />
          <InfoRow label="Employer" value={profile.employer} />
        </Section>

        {/* Family */}
        <Section title="Family">
          {(profile as any).family_details && Object.keys((profile as any).family_details).length > 0 ? (
            Object.entries((profile as any).family_details).map(([key, val]) => (
              <InfoRow key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
            ))
          ) : (
            <Text style={styles.mutedText}>Family details not provided</Text>
          )}
        </Section>

        {/* Hobbies */}
        {profile.languages.length > 0 && (
          <Section title="Languages">
            <View style={styles.tagRow}>
              {profile.languages.map((lang) => (
                <Badge key={lang} label={lang} variant="gray" size="sm" />
              ))}
            </View>
          </Section>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.back()}>
          <Ionicons name="close-circle" size={32} color={colors.gray[400]} />
          <Text style={styles.actionLabel}>Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.primaryAction]}
          onPress={handleSendInterest}
          disabled={sendInterest.isPending}
        >
          <Ionicons name="heart" size={28} color={colors.white} />
          <Text style={[styles.actionLabel, { color: colors.white }]}>Interest</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleSuperLike}>
          <Ionicons name="star" size={32} color={colors.gold} />
          <Text style={styles.actionLabel}>Super Like</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  errorText: { fontSize: fonts.sizes.lg, color: colors.gray[600], marginTop: spacing.md },
  backLink: { marginTop: spacing.md },
  backLinkText: { color: colors.rose, fontSize: fonts.sizes.md, fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing['2xl'], paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[200],
  },
  headerBtn: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['2xl'] },
  avatarSection: { alignItems: 'center', paddingVertical: spacing.lg, backgroundColor: colors.white },
  largePhoto: { width: 120, height: 120, borderRadius: 60 },
  name: { fontSize: fonts.sizes['2xl'], fontWeight: '700', color: colors.deep, marginTop: spacing.md },
  subtitle: { fontSize: fonts.sizes.md, color: colors.gray[600], marginTop: spacing.xs },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  section: {
    backgroundColor: colors.white, marginTop: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  sectionTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep, marginBottom: spacing.md },
  compatHeader: { alignItems: 'center', marginBottom: spacing.md },
  compatScore: { fontSize: fonts.sizes['4xl'], fontWeight: '700', color: colors.rose },
  compatLabel: { fontSize: fonts.sizes.sm, color: colors.gray[600] },
  compatRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm,
  },
  compatDimLabel: { width: 100, fontSize: fonts.sizes.sm, color: colors.deep },
  compatBarWrap: { flex: 1 },
  compatPct: { width: 36, fontSize: fonts.sizes.xs, color: colors.gray[600], textAlign: 'right' },
  progressTrack: {
    height: 6, backgroundColor: colors.gray[200], borderRadius: borderRadius.full, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.rose, borderRadius: borderRadius.full },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  infoLabel: { fontSize: fonts.sizes.sm, color: colors.gray[600] },
  infoValue: { fontSize: fonts.sizes.sm, color: colors.deep, fontWeight: '500' },
  bioText: { fontSize: fonts.sizes.md, color: colors.gray[700], lineHeight: 22 },
  mutedText: { fontSize: fonts.sizes.sm, color: colors.gray[400] },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bottomPad: { height: spacing['2xl'] },
  actionBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: spacing.md, paddingBottom: spacing.lg,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray[200],
  },
  actionBtn: { alignItems: 'center', gap: spacing.xs },
  primaryAction: {
    backgroundColor: colors.rose, borderRadius: borderRadius.full,
    width: 64, height: 64, justifyContent: 'center',
  },
  actionLabel: { fontSize: fonts.sizes.xs, color: colors.gray[600] },
});
