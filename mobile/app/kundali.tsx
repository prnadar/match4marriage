import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import { useMyProfile } from '@/hooks/useApi';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface GunaScore {
  name: string;
  maxPoints: number;
  obtained: number;
  description: string;
}

const MOCK_GUNA_RESULTS: GunaScore[] = [
  { name: 'Varna', maxPoints: 1, obtained: 1, description: 'Spiritual compatibility' },
  { name: 'Vashya', maxPoints: 2, obtained: 2, description: 'Mutual attraction' },
  { name: 'Tara', maxPoints: 3, obtained: 2, description: 'Birth star compatibility' },
  { name: 'Yoni', maxPoints: 4, obtained: 3, description: 'Nature compatibility' },
  { name: 'Graha Maitri', maxPoints: 5, obtained: 4, description: 'Intellectual compatibility' },
  { name: 'Gana', maxPoints: 6, obtained: 5, description: 'Temperament match' },
  { name: 'Bhakoot', maxPoints: 7, obtained: 7, description: 'Love & family' },
  { name: 'Nadi', maxPoints: 8, obtained: 6, description: 'Health & genes' },
];

const MOCK_DOSHA = {
  manglik: { present: false, severity: 'None' as const },
  nadi: { present: true, severity: 'Mild' as const },
};

function ScoreBar({ obtained, max }: { obtained: number; max: number }) {
  const pct = (obtained / max) * 100;
  return (
    <View style={styles.scoreBarTrack}>
      <View style={[styles.scoreBarFill, { width: `${pct}%` }]} />
    </View>
  );
}

export default function KundaliScreen() {
  const router = useRouter();
  const { data: myProfile } = useMyProfile();
  const [hasResult, setHasResult] = useState(false);
  const [isMatching, setIsMatching] = useState(false);

  const totalObtained = MOCK_GUNA_RESULTS.reduce((sum, g) => sum + g.obtained, 0);
  const totalMax = MOCK_GUNA_RESULTS.reduce((sum, g) => sum + g.maxPoints, 0);

  const handleMatch = () => {
    setIsMatching(true);
    // Simulate API call
    setTimeout(() => {
      setIsMatching(false);
      setHasResult(true);
    }, 2000);
  };

  const getScoreColor = (score: number, total: number): string => {
    const pct = (score / total) * 100;
    if (pct >= 75) return colors.success;
    if (pct >= 50) return colors.gold;
    return colors.error;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.deep} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="flower-outline" size={20} color={colors.gold} />
          <Text style={styles.headerTitle}>Kundali Matching</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Info Section */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.gold} />
          <Text style={styles.infoText}>
            Ashtakoot Guna Milan evaluates compatibility across 8 dimensions with a maximum of 36 points. A score of 18+ is considered favorable for marriage.
          </Text>
        </View>

        {/* Profile Selectors */}
        <View style={styles.profilePair}>
          <View style={styles.profileCard}>
            <Text style={styles.profileCardLabel}>Your Profile</Text>
            <Ionicons name="person-circle" size={48} color={colors.rose} />
            <Text style={styles.profileCardName}>
              {myProfile ? `${myProfile.first_name} ${myProfile.last_name}` : 'Loading...'}
            </Text>
            {myProfile?.birth_time ? (
              <View style={styles.birthDetails}>
                <Text style={styles.birthText}>{myProfile.date_of_birth ?? 'DOB not set'}</Text>
                <Text style={styles.birthText}>{myProfile.birth_time}</Text>
                <Text style={styles.birthText}>{myProfile.birth_place || 'Place not set'}</Text>
              </View>
            ) : (
              <Text style={styles.missingText}>Birth details missing</Text>
            )}
          </View>

          <Ionicons name="swap-horizontal" size={24} color={colors.gold} />

          <View style={styles.profileCard}>
            <Text style={styles.profileCardLabel}>Partner's Profile</Text>
            <Ionicons name="person-circle-outline" size={48} color={colors.goldLight} />
            <Text style={styles.profileCardName}>Select Partner</Text>
            <TouchableOpacity style={styles.selectBtn}>
              <Text style={styles.selectBtnText}>Choose</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Match Button */}
        <View style={styles.matchBtnWrap}>
          <Button
            title={isMatching ? 'Matching...' : 'Match Kundali'}
            onPress={handleMatch}
            variant="gold"
            size="lg"
            fullWidth
            loading={isMatching}
            icon="sparkles"
          />
        </View>

        {/* Results */}
        {hasResult && (
          <>
            {/* Overall Score */}
            <View style={styles.resultCard}>
              <Text style={styles.resultHeading}>Match Result</Text>
              <View style={styles.overallScore}>
                <Text style={[styles.scoreNumber, { color: getScoreColor(totalObtained, totalMax) }]}>
                  {totalObtained}
                </Text>
                <Text style={styles.scoreOf}>/ {totalMax}</Text>
              </View>
              <Badge
                label={totalObtained >= 25 ? 'Excellent Match' : totalObtained >= 18 ? 'Good Match' : 'Below Average'}
                variant={totalObtained >= 18 ? 'sage' : 'error'}
              />
            </View>

            {/* Individual Gunas */}
            <View style={styles.gunaSection}>
              <Text style={styles.gunaSectionTitle}>Guna Breakdown</Text>
              {MOCK_GUNA_RESULTS.map((guna) => (
                <View key={guna.name} style={styles.gunaRow}>
                  <View style={styles.gunaInfo}>
                    <Text style={styles.gunaName}>{guna.name}</Text>
                    <Text style={styles.gunaDesc}>{guna.description}</Text>
                  </View>
                  <View style={styles.gunaBarWrap}>
                    <ScoreBar obtained={guna.obtained} max={guna.maxPoints} />
                  </View>
                  <Text style={styles.gunaPoints}>
                    {guna.obtained}/{guna.maxPoints}
                  </Text>
                </View>
              ))}
            </View>

            {/* Dosha Analysis */}
            <View style={styles.doshaSection}>
              <Text style={styles.gunaSectionTitle}>Dosha Analysis</Text>
              <View style={styles.doshaRow}>
                <Ionicons
                  name={MOCK_DOSHA.manglik.present ? 'warning' : 'checkmark-circle'}
                  size={20}
                  color={MOCK_DOSHA.manglik.present ? colors.warning : colors.success}
                />
                <View style={styles.doshaInfo}>
                  <Text style={styles.doshaName}>Manglik Dosha</Text>
                  <Text style={styles.doshaSeverity}>Severity: {MOCK_DOSHA.manglik.severity}</Text>
                </View>
              </View>
              <View style={styles.doshaRow}>
                <Ionicons
                  name={MOCK_DOSHA.nadi.present ? 'warning' : 'checkmark-circle'}
                  size={20}
                  color={MOCK_DOSHA.nadi.present ? colors.warning : colors.success}
                />
                <View style={styles.doshaInfo}>
                  <Text style={styles.doshaName}>Nadi Dosha</Text>
                  <Text style={styles.doshaSeverity}>Severity: {MOCK_DOSHA.nadi.severity}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing['2xl'], paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[200],
  },
  headerBtn: { width: 40, alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing['2xl'] },
  infoCard: {
    flexDirection: 'row', backgroundColor: colors.creamDark, borderRadius: borderRadius.md,
    padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
    borderLeftWidth: 3, borderLeftColor: colors.gold,
  },
  infoText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.gray[700], lineHeight: 20 },
  profilePair: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, marginBottom: spacing.lg,
  },
  profileCard: {
    flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.md, alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.gray[200],
  },
  profileCardLabel: { fontSize: fonts.sizes.xs, color: colors.gray[500], fontWeight: '600', textTransform: 'uppercase' },
  profileCardName: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.deep },
  birthDetails: { alignItems: 'center', marginTop: spacing.xs },
  birthText: { fontSize: fonts.sizes.xs, color: colors.gray[600] },
  missingText: { fontSize: fonts.sizes.xs, color: colors.warning },
  selectBtn: {
    backgroundColor: colors.creamDark, paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderRadius: borderRadius.sm,
  },
  selectBtnText: { fontSize: fonts.sizes.xs, color: colors.rose, fontWeight: '600' },
  matchBtnWrap: { marginBottom: spacing.lg },
  resultCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.goldLight,
  },
  resultHeading: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep, marginBottom: spacing.sm },
  overallScore: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.sm },
  scoreNumber: { fontSize: fonts.sizes['4xl'], fontWeight: '700' },
  scoreOf: { fontSize: fonts.sizes.xl, color: colors.gray[500], marginLeft: spacing.xs },
  gunaSection: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md,
  },
  gunaSectionTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep, marginBottom: spacing.md },
  gunaRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  gunaInfo: { width: 120 },
  gunaName: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.deep },
  gunaDesc: { fontSize: fonts.sizes.xs, color: colors.gray[500] },
  gunaBarWrap: { flex: 1, marginHorizontal: spacing.sm },
  gunaPoints: { width: 32, fontSize: fonts.sizes.sm, color: colors.gold, fontWeight: '600', textAlign: 'right' },
  scoreBarTrack: {
    height: 6, backgroundColor: colors.gray[200], borderRadius: borderRadius.full, overflow: 'hidden',
  },
  scoreBarFill: { height: 6, backgroundColor: colors.gold, borderRadius: borderRadius.full },
  doshaSection: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md,
  },
  doshaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  doshaInfo: { flex: 1 },
  doshaName: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.deep },
  doshaSeverity: { fontSize: fonts.sizes.sm, color: colors.gray[600] },
});
