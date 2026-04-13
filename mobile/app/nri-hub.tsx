import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';

interface Region {
  key: string;
  label: string;
  flag: string;
}

interface NriProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  country: string;
  occupation: string;
  photoUrl: string | null;
}

const REGIONS: readonly Region[] = [
  { key: 'uk', label: 'UK', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
  { key: 'us', label: 'US', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
  { key: 'uae', label: 'UAE', flag: '\uD83C\uDDE6\uD83C\uDDEA' },
  { key: 'ca', label: 'Canada', flag: '\uD83C\uDDE8\uD83C\uDDE6' },
  { key: 'au', label: 'Australia', flag: '\uD83C\uDDE6\uD83C\uDDFA' },
  { key: 'other', label: 'Other', flag: '\uD83C\uDF0D' },
];

const MOCK_PROFILES: readonly NriProfile[] = [
  { id: '1', name: 'Aditya Sharma', age: 29, city: 'London', country: 'UK', occupation: 'Software Engineer', photoUrl: null },
  { id: '2', name: 'Neha Patel', age: 27, city: 'Toronto', country: 'Canada', occupation: 'Doctor', photoUrl: null },
  { id: '3', name: 'Rohan Mehta', age: 31, city: 'Dubai', country: 'UAE', occupation: 'Finance Manager', photoUrl: null },
  { id: '4', name: 'Kavya Iyer', age: 26, city: 'Sydney', country: 'Australia', occupation: 'Data Scientist', photoUrl: null },
];

const INFO_CARDS: readonly { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }[] = [
  { icon: 'time-outline', title: 'Timezone-Aware Matching', description: 'We find matches considering your timezone for convenient communication.' },
  { icon: 'people-outline', title: 'Family Participation', description: 'Parents and family can be involved in the search from back home.' },
  { icon: 'airplane-outline', title: 'Visa-Compatible Matches', description: 'Filter by visa status and relocation willingness for practical compatibility.' },
];

function ProfileCard({ profile }: { profile: NriProfile }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.profileCard}
      onPress={() => router.push(`/profile/${profile.id}`)}
      activeOpacity={0.7}
    >
      <Avatar name={profile.name} photoUrl={profile.photoUrl} size="lg" />
      <Text style={styles.profileName}>{profile.name}, {profile.age}</Text>
      <Text style={styles.profileLocation}>{profile.city}, {profile.country}</Text>
      <Text style={styles.profileOccupation}>{profile.occupation}</Text>
    </TouchableOpacity>
  );
}

export default function NriHubScreen() {
  const router = useRouter();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const filteredProfiles = selectedRegion
    ? MOCK_PROFILES.filter((p) => {
        const regionMap: Record<string, string> = { uk: 'UK', us: 'US', uae: 'UAE', ca: 'Canada', au: 'Australia' };
        return regionMap[selectedRegion] === p.country;
      })
    : MOCK_PROFILES;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.deep} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="globe-outline" size={20} color={colors.rose} />
          <Text style={styles.headerTitle}>NRI Hub</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Region Selector */}
        <Text style={styles.sectionLabel}>Select Region</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionScroll}>
          {REGIONS.map((region) => (
            <TouchableOpacity
              key={region.key}
              style={[
                styles.regionChip,
                selectedRegion === region.key && styles.regionChipActive,
              ]}
              onPress={() => setSelectedRegion(
                selectedRegion === region.key ? null : region.key
              )}
            >
              <Text style={styles.regionFlag}>{region.flag}</Text>
              <Text
                style={[
                  styles.regionLabel,
                  selectedRegion === region.key && styles.regionLabelActive,
                ]}
              >
                {region.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured Profiles */}
        <Text style={styles.sectionLabel}>Featured NRI Profiles</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profileScroll}>
          {filteredProfiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
          {filteredProfiles.length === 0 && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No profiles in this region yet</Text>
            </View>
          )}
        </ScrollView>

        {/* Info Cards */}
        <Text style={styles.sectionLabel}>Why NRI Hub?</Text>
        {INFO_CARDS.map((card) => (
          <View key={card.title} style={styles.infoCard}>
            <View style={styles.infoIconWrap}>
              <Ionicons name={card.icon} size={24} color={colors.rose} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>{card.title}</Text>
              <Text style={styles.infoDesc}>{card.description}</Text>
            </View>
          </View>
        ))}

        {/* Cultural Connection */}
        <View style={styles.cultureCard}>
          <Ionicons name="heart-circle" size={32} color={colors.gold} />
          <Text style={styles.cultureTitle}>Cultural Connection</Text>
          <Text style={styles.cultureDesc}>
            Stay connected to your roots while finding a life partner who understands the NRI experience.
          </Text>
        </View>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <Button
            title="Find NRI Matches"
            onPress={() => {}}
            variant="primary"
            size="lg"
            fullWidth
            icon="search"
          />
        </View>
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
  scrollContent: { paddingBottom: spacing['2xl'] },
  sectionLabel: {
    fontSize: fonts.sizes.md, fontWeight: '700', color: colors.deep,
    paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  regionScroll: { paddingHorizontal: spacing.md },
  regionChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginRight: spacing.sm, borderWidth: 1, borderColor: colors.gray[200],
  },
  regionChipActive: { backgroundColor: colors.rose, borderColor: colors.rose },
  regionFlag: { fontSize: fonts.sizes.xl },
  regionLabel: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.deep },
  regionLabelActive: { color: colors.white },
  profileScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  profileCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.md, marginRight: spacing.md, alignItems: 'center',
    width: 160, borderWidth: 1, borderColor: colors.gray[200],
  },
  profileName: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.deep, marginTop: spacing.sm, textAlign: 'center' },
  profileLocation: { fontSize: fonts.sizes.xs, color: colors.gray[600] },
  profileOccupation: { fontSize: fonts.sizes.xs, color: colors.rose, marginTop: spacing.xs },
  noResults: { padding: spacing.lg },
  noResultsText: { fontSize: fonts.sizes.sm, color: colors.gray[500] },
  infoCard: {
    flexDirection: 'row', backgroundColor: colors.white, borderRadius: borderRadius.md,
    padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    gap: spacing.md, borderWidth: 1, borderColor: colors.gray[100],
  },
  infoIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.rose}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.deep },
  infoDesc: { fontSize: fonts.sizes.sm, color: colors.gray[600], marginTop: spacing.xs, lineHeight: 20 },
  cultureCard: {
    backgroundColor: colors.creamDark, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginHorizontal: spacing.md, marginTop: spacing.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.goldLight,
  },
  cultureTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep, marginTop: spacing.sm },
  cultureDesc: {
    fontSize: fonts.sizes.sm, color: colors.gray[700], textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 20,
  },
  ctaWrap: { padding: spacing.lg },
});
