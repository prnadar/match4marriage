import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import { useAuthStore } from '@/store/auth';
import { useSubscriptionLimits } from '@/hooks/useApi';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type { SubscriptionTier } from '@/types';

interface PlanConfig {
  tier: SubscriptionTier;
  name: string;
  monthlyPrice: number;
  features: readonly string[];
  recommended: boolean;
  badgeVariant: 'gray' | 'primary' | 'gold' | 'sage';
}

const PLANS: readonly PlanConfig[] = [
  {
    tier: 'free', name: 'Free', monthlyPrice: 0, recommended: false, badgeVariant: 'gray',
    features: [
      '5 interests per month',
      'View basic profiles',
      'Limited search filters',
    ],
  },
  {
    tier: 'silver', name: 'Silver', monthlyPrice: 999, recommended: false, badgeVariant: 'gray',
    features: [
      '20 interests per month',
      'View contact details',
      'Advanced search filters',
      'See who viewed your profile',
    ],
  },
  {
    tier: 'gold', name: 'Gold', monthlyPrice: 2499, recommended: true, badgeVariant: 'gold',
    features: [
      '50 interests per month',
      'Video calls (10/month)',
      'Priority in search results',
      'Kundali matching',
      'Send voice notes',
      'Incognito browsing',
    ],
  },
  {
    tier: 'platinum', name: 'Platinum', monthlyPrice: 7999, recommended: false, badgeVariant: 'primary',
    features: [
      'Unlimited interests',
      'Unlimited video calls',
      'Dedicated relationship advisor',
      'All Gold features',
      'Profile boost (weekly)',
      'Priority customer support',
    ],
  },
];

const ANNUAL_DISCOUNT = 0.20;

function formatPrice(amount: number): string {
  if (amount === 0) return 'Free';
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

function PlanCard({
  plan,
  isAnnual,
  isCurrent,
  onSelect,
}: {
  plan: PlanConfig;
  isAnnual: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const monthlyPrice = isAnnual && plan.monthlyPrice > 0
    ? Math.round(plan.monthlyPrice * (1 - ANNUAL_DISCOUNT))
    : plan.monthlyPrice;

  return (
    <View
      style={[
        styles.planCard,
        plan.recommended && styles.recommendedCard,
        isCurrent && styles.currentCard,
      ]}
    >
      {plan.recommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>RECOMMENDED</Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <Badge label={plan.name} variant={plan.badgeVariant} />
        {isCurrent && <Badge label="Current" variant="sage" size="sm" />}
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(monthlyPrice)}</Text>
        {plan.monthlyPrice > 0 && <Text style={styles.pricePeriod}>/mo</Text>}
      </View>

      {isAnnual && plan.monthlyPrice > 0 && (
        <Text style={styles.savings}>
          Save {formatPrice(Math.round(plan.monthlyPrice * ANNUAL_DISCOUNT * 12))}/year
        </Text>
      )}

      <View style={styles.featureList}>
        {plan.features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.sage} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <Button
        title={isCurrent ? 'Current Plan' : 'Upgrade'}
        onPress={onSelect}
        variant={isCurrent ? 'secondary' : plan.recommended ? 'gold' : 'primary'}
        fullWidth
        disabled={isCurrent}
      />
    </View>
  );
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const currentTier = useAuthStore((s) => s.subscriptionTier);
  const { data: limits } = useSubscriptionLimits();
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.deep} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Current Limits */}
        {limits && (
          <View style={styles.limitsCard}>
            <Text style={styles.limitsTitle}>Your Current Usage</Text>
            <View style={styles.limitsRow}>
              <Text style={styles.limitLabel}>Interests: {limits.interests}/mo</Text>
              <Text style={styles.limitLabel}>Contacts: {limits.contacts}/mo</Text>
              <Text style={styles.limitLabel}>Video Calls: {limits.video_calls}/mo</Text>
            </View>
          </View>
        )}

        {/* Toggle */}
        <View style={styles.toggleWrap}>
          <TouchableOpacity
            style={[styles.toggleBtn, !isAnnual && styles.toggleActive]}
            onPress={() => setIsAnnual(false)}
          >
            <Text style={[styles.toggleText, !isAnnual && styles.toggleTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, isAnnual && styles.toggleActive]}
            onPress={() => setIsAnnual(true)}
          >
            <Text style={[styles.toggleText, isAnnual && styles.toggleTextActive]}>
              Annual (-20%)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plans */}
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            isAnnual={isAnnual}
            isCurrent={plan.tier === currentTier}
            onSelect={() => {}}
          />
        ))}

        <Text style={styles.disclaimer}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Prices are in INR.
        </Text>
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
  headerTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing['2xl'] },
  limitsCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  limitsTitle: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.deep, marginBottom: spacing.sm },
  limitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  limitLabel: { fontSize: fonts.sizes.sm, color: colors.gray[600] },
  toggleWrap: {
    flexDirection: 'row', backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full, padding: spacing.xs, marginBottom: spacing.lg,
  },
  toggleBtn: {
    flex: 1, paddingVertical: spacing.sm,
    alignItems: 'center', borderRadius: borderRadius.full,
  },
  toggleActive: { backgroundColor: colors.white },
  toggleText: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.gray[500] },
  toggleTextActive: { color: colors.rose },
  planCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.gray[200],
  },
  recommendedCard: { borderColor: colors.gold, borderWidth: 2 },
  currentCard: { borderColor: colors.sage },
  recommendedBadge: {
    position: 'absolute', top: -10, right: spacing.md,
    backgroundColor: colors.gold, paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs, borderRadius: borderRadius.sm,
  },
  recommendedText: { fontSize: fonts.sizes.xs, fontWeight: '700', color: colors.white },
  planHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.xs },
  price: { fontSize: fonts.sizes['3xl'], fontWeight: '700', color: colors.deep },
  pricePeriod: { fontSize: fonts.sizes.md, color: colors.gray[500], marginLeft: spacing.xs },
  savings: { fontSize: fonts.sizes.sm, color: colors.sage, fontWeight: '600', marginBottom: spacing.sm },
  featureList: { marginVertical: spacing.md, gap: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { fontSize: fonts.sizes.sm, color: colors.gray[700] },
  disclaimer: {
    fontSize: fonts.sizes.xs, color: colors.gray[500],
    textAlign: 'center', marginTop: spacing.md, lineHeight: 16,
  },
});
