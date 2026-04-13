import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  status: 'active' | 'invited';
}

const MOCK_FAMILY: readonly FamilyMember[] = [
  { id: '1', name: 'Rajesh Kumar', relation: 'Father', status: 'active' },
  { id: '2', name: 'Sunita Kumar', relation: 'Mother', status: 'active' },
  { id: '3', name: 'Amit Kumar', relation: 'Brother', status: 'invited' },
];

const BENEFITS: readonly { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }[] = [
  {
    icon: 'eye-outline',
    title: 'Parents Can Review Matches',
    description: 'Family members can view and shortlist profiles on your behalf.',
  },
  {
    icon: 'git-merge-outline',
    title: 'Joint Decision Making',
    description: 'Collaborate with family to make informed decisions together.',
  },
  {
    icon: 'ribbon-outline',
    title: 'Family Values Alignment',
    description: 'Ensure potential matches align with your family traditions and values.',
  },
];

function MemberCard({ member }: { member: FamilyMember }) {
  const isActive = member.status === 'active';

  return (
    <View style={styles.memberCard}>
      <Avatar name={member.name} size="md" />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberRelation}>{member.relation}</Text>
      </View>
      <Badge
        label={isActive ? 'Active' : 'Invited'}
        variant={isActive ? 'sage' : 'gray'}
        size="sm"
      />
    </View>
  );
}

export default function FamilyScreen() {
  const router = useRouter();
  const [familyChatEnabled, setFamilyChatEnabled] = useState(true);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.deep} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="people" size={20} color={colors.rose} />
          <Text style={styles.headerTitle}>Family Mode</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={colors.gold} />
          <Text style={styles.infoText}>
            Involve your family in the matchmaking process. Invited family members can view profiles, shortlist matches, and participate in discussions.
          </Text>
        </View>

        {/* Invite Button */}
        <View style={styles.inviteWrap}>
          <Button
            title="Invite Family Member"
            onPress={() => {}}
            variant="primary"
            icon="person-add"
            fullWidth
          />
        </View>

        {/* Family Members */}
        <Text style={styles.sectionTitle}>Family Members</Text>
        <View style={styles.membersCard}>
          {MOCK_FAMILY.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
          {MOCK_FAMILY.length === 0 && (
            <View style={styles.emptyMembers}>
              <Ionicons name="people-outline" size={40} color={colors.gray[300]} />
              <Text style={styles.emptyText}>No family members added yet</Text>
            </View>
          )}
        </View>

        {/* Family Chat Toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleInfo}>
            <Ionicons name="chatbubbles-outline" size={20} color={colors.rose} />
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Family Chat</Text>
              <Text style={styles.toggleDesc}>
                Enable group chat with your family members about matches
              </Text>
            </View>
          </View>
          <Switch
            value={familyChatEnabled}
            onValueChange={setFamilyChatEnabled}
            trackColor={{ true: colors.rose, false: colors.gray[300] }}
          />
        </View>

        {/* Benefits */}
        <Text style={styles.sectionTitle}>Benefits</Text>
        {BENEFITS.map((benefit) => (
          <View key={benefit.title} style={styles.benefitCard}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name={benefit.icon} size={24} color={colors.rose} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitDesc}>{benefit.description}</Text>
            </View>
          </View>
        ))}
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
  infoBanner: {
    flexDirection: 'row', backgroundColor: colors.creamDark, borderRadius: borderRadius.md,
    padding: spacing.md, margin: spacing.md, gap: spacing.sm,
    borderLeftWidth: 3, borderLeftColor: colors.gold,
  },
  infoText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.gray[700], lineHeight: 20 },
  inviteWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sectionTitle: {
    fontSize: fonts.sizes.md, fontWeight: '700', color: colors.deep,
    paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  membersCard: {
    backgroundColor: colors.white, marginHorizontal: spacing.md,
    borderRadius: borderRadius.md, overflow: 'hidden',
  },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.deep },
  memberRelation: { fontSize: fonts.sizes.sm, color: colors.gray[600] },
  emptyMembers: { alignItems: 'center', padding: spacing.lg },
  emptyText: { fontSize: fonts.sizes.sm, color: colors.gray[500], marginTop: spacing.sm },
  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: borderRadius.md, padding: spacing.md,
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  toggleTextWrap: { flex: 1 },
  toggleTitle: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.deep },
  toggleDesc: { fontSize: fonts.sizes.xs, color: colors.gray[600], marginTop: spacing.xs },
  benefitCard: {
    flexDirection: 'row', backgroundColor: colors.white, borderRadius: borderRadius.md,
    padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    gap: spacing.md, borderWidth: 1, borderColor: colors.gray[100],
  },
  benefitIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.rose}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  benefitContent: { flex: 1 },
  benefitTitle: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.deep },
  benefitDesc: { fontSize: fonts.sizes.sm, color: colors.gray[600], marginTop: spacing.xs, lineHeight: 20 },
});
