import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import { MOCK_PROFILES as MOCK_PROFILES_DATA } from '@/lib/mockProfiles';
import type { ProfileCard, Religion } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = spacing.sm;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - CARD_GAP) / 2;

const RELIGIONS: readonly Religion[] = [
  'hindu', 'muslim', 'christian', 'sikh', 'jain', 'buddhist', 'parsi', 'other',
] as const;

const MOCK_PROFILES: readonly ProfileCard[] = MOCK_PROFILES_DATA as unknown as ProfileCard[];

interface Filters {
  readonly religion: Religion | null;
  readonly minAge: number;
  readonly maxAge: number;
  readonly city: string;
  readonly verifiedOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  religion: null,
  minAge: 21,
  maxAge: 40,
  city: '',
  verifiedOnly: false,
};

export default function MatchesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [likedIds, setLikedIds] = useState<ReadonlySet<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const filteredProfiles = useMemo(() => {
    return MOCK_PROFILES.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(q);
        const cityMatch = p.city.toLowerCase().includes(q);
        if (!nameMatch && !cityMatch) return false;
      }
      if (filters.religion && p.religion !== filters.religion) return false;
      if (p.age < filters.minAge || p.age > filters.maxAge) return false;
      if (filters.city && !p.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (filters.verifiedOnly && !p.is_verified) return false;
      return true;
    });
  }, [search, filters]);

  const toggleLike = useCallback((userId: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  const updateFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const renderCard = useCallback(
    ({ item }: { item: ProfileCard }) => {
      const isLiked = likedIds.has(item.user_id);
      return (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push(`/profile/${item.user_id}`)}
        >
          <View style={styles.cardImage}>
            {item.photos && item.photos.length > 0 ? (
              <Image
                source={{ uri: item.photos[0].url }}
                style={styles.cardPhoto}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={40} color={colors.gray[400]} />
            )}
            {item.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.sage} />
              </View>
            )}
            <TouchableOpacity
              style={styles.likeButton}
              onPress={() => toggleLike(item.user_id)}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={isLiked ? colors.rose : colors.white}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.first_name}, {item.age}
            </Text>
            <Text style={styles.cardCity} numberOfLines={1}>
              {item.city}
            </Text>
            <Text style={styles.cardOccupation} numberOfLines={1}>
              {item.occupation}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [likedIds, router, toggleLike],
  );

  const keyExtractor = useCallback((item: ProfileCard) => item.user_id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Browse Matches</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.gray[500]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or city"
            placeholderTextColor={colors.gray[400]}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Ionicons name="options" size={20} color={showFilters ? colors.white : colors.rose} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Religion</Text>
            <FlatList
              horizontal
              data={RELIGIONS}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(r) => r}
              renderItem={({ item: r }) => (
                <TouchableOpacity
                  style={[styles.chip, filters.religion === r && styles.chipActive]}
                  onPress={() => updateFilter('religion', filters.religion === r ? null : r)}
                >
                  <Text style={[styles.chipText, filters.religion === r && styles.chipTextActive]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>
              Age: {filters.minAge} - {filters.maxAge}
            </Text>
          </View>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.chip, filters.verifiedOnly && styles.chipActive]}
              onPress={() => updateFilter('verifiedOnly', !filters.verifiedOnly)}
            >
              <Text style={[styles.chipText, filters.verifiedOnly && styles.chipTextActive]}>
                Verified Only
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={filteredProfiles}
        renderItem={renderCard}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.rose} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={56} color={colors.gray[300]} />
            <Text style={styles.emptyText}>No matches found. Try adjusting your filters.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  title: { fontSize: fonts.sizes['2xl'], fontWeight: '700', color: colors.deep, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1, borderColor: colors.gray[200] },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: fonts.sizes.md, color: colors.deep },
  filterToggle: { width: 44, height: 44, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.rose, justifyContent: 'center', alignItems: 'center' },
  filterToggleActive: { backgroundColor: colors.rose, borderColor: colors.rose },
  filterPanel: { backgroundColor: colors.white, margin: spacing.md, borderRadius: borderRadius.md, padding: spacing.md },
  filterRow: { marginBottom: spacing.sm },
  filterLabel: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.deep, marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray[300], marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.rose, borderColor: colors.rose },
  chipText: { fontSize: fonts.sizes.sm, color: colors.gray[700] },
  chipTextActive: { color: colors.white },
  list: { padding: spacing.md, paddingBottom: spacing['2xl'] },
  row: { gap: CARD_GAP },
  card: { width: CARD_WIDTH, backgroundColor: colors.white, borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: CARD_GAP, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardImage: { width: '100%', height: CARD_WIDTH * 1.1, backgroundColor: colors.creamDark, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  cardPhoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  verifiedBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  likeButton: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 32, height: 32, borderRadius: borderRadius.full, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: spacing.sm },
  cardName: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.deep },
  cardCity: { fontSize: fonts.sizes.sm, color: colors.gray[600], marginTop: 2 },
  cardOccupation: { fontSize: fonts.sizes.xs, color: colors.gray[500], marginTop: 2 },
  emptyState: { alignItems: 'center', paddingTop: spacing['2xl'] },
  emptyText: { fontSize: fonts.sizes.md, color: colors.gray[500], textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.xl },
});
