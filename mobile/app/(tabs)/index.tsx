import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDailyMatches, useSendInterest } from '@/hooks/useApi';
import { useAuthStore } from '@/store/auth';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import type { Match } from '@/types';
import { Ionicons } from '@expo/vector-icons';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatRefreshTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { data, isLoading, refetch } = useDailyMatches();
  const sendInterest = useSendInterest();
  const [passedIds, setPassedIds] = useState<ReadonlySet<string>>(new Set());

  const visibleMatches = useMemo(() => {
    if (!data?.matches) return [];
    return data.matches.filter((m) => !passedIds.has(m.id));
  }, [data?.matches, passedIds]);

  const handleInterest = useCallback(
    (match: Match) => {
      sendInterest.mutate({
        receiverId: match.other_profile.user_id,
      });
    },
    [sendInterest],
  );

  const handlePass = useCallback((match: Match) => {
    setPassedIds((prev) => new Set([...prev, match.id]));
  }, []);

  const handlePress = useCallback(
    (match: Match) => {
      router.push(`/profile/${match.other_profile.user_id}`);
    },
    [router],
  );

  const renderMatch = useCallback(
    ({ item }: { item: Match }) => {
      const p = item.other_profile;
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={32} color={colors.gray[400]} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>
                {p.first_name} {p.last_name}
              </Text>
              <Text style={styles.cardMeta}>
                {p.age} yrs, {p.city}
              </Text>
              <Text style={styles.cardMeta}>{p.occupation}</Text>
            </View>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>
                {item.compatibility_score}%
              </Text>
              <Text style={styles.scoreLabel}>Match</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <View style={styles.actionButton}>
              <Ionicons
                name="close-circle-outline"
                size={28}
                color={colors.gray[500]}
                onPress={() => handlePass(item)}
              />
            </View>
            <View style={styles.actionButton}>
              <Ionicons
                name="heart"
                size={28}
                color={colors.rose}
                onPress={() => handleInterest(item)}
              />
            </View>
            <View style={styles.actionButton}>
              <Ionicons
                name="arrow-forward-circle-outline"
                size={28}
                color={colors.sage}
                onPress={() => handlePress(item)}
              />
            </View>
          </View>
        </View>
      );
    },
    [handleInterest, handlePass, handlePress],
  );

  const keyExtractor = useCallback((item: Match) => item.id, []);

  const firstName = profile?.first_name ?? 'there';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {getGreeting()}, {firstName}
        </Text>
        <Text style={styles.date}>{formatDate()}</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's Matches</Text>
        {data && (
          <Text style={styles.remaining}>
            {data.remaining_today} remaining
          </Text>
        )}
      </View>

      {data?.refreshes_at && (
        <Text style={styles.refreshTimer}>
          Next refresh at {formatRefreshTime(data.refreshes_at)}
        </Text>
      )}

      <FlatList
        data={visibleMatches}
        renderItem={renderMatch}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.rose}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>
              You've reviewed all your matches for today. Check back later for
              more.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  greeting: {
    fontSize: fonts.sizes['2xl'],
    fontWeight: '700',
    color: colors.deep,
  },
  date: {
    fontSize: fonts.sizes.sm,
    color: colors.gray[600],
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: '700',
    color: colors.deep,
  },
  remaining: {
    fontSize: fonts.sizes.sm,
    color: colors.rose,
    fontWeight: '600',
  },
  refreshTimer: {
    fontSize: fonts.sizes.xs,
    color: colors.gray[500],
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.creamDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardName: {
    fontSize: fonts.sizes.lg,
    fontWeight: '700',
    color: colors.deep,
  },
  cardMeta: {
    fontSize: fonts.sizes.sm,
    color: colors.gray[600],
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  scoreText: {
    fontSize: fonts.sizes.xl,
    fontWeight: '800',
    color: colors.rose,
  },
  scoreLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.gray[500],
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  actionButton: {
    padding: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
  },
  emptyTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: '700',
    color: colors.deep,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fonts.sizes.md,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
