import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import type { InterestStatus } from '@/types';

type TabKey = 'received' | 'sent' | 'mutual';

const TAB_OPTIONS: readonly { key: TabKey; label: string }[] = [
  { key: 'received', label: 'Received' },
  { key: 'sent', label: 'Sent' },
  { key: 'mutual', label: 'Mutual' },
] as const;

interface MockInterest {
  id: string;
  name: string;
  age: number;
  city: string;
  occupation: string;
  photo: string;
  status: InterestStatus;
  is_super_interest: boolean;
  message?: string;
  threadId?: string;
}

const MOCK_RECEIVED: MockInterest[] = [
  { id: 'r1', name: 'Priya Sharma', age: 27, city: 'Mumbai', occupation: 'Software Engineer', photo: 'https://randomuser.me/api/portraits/women/44.jpg', status: 'pending', is_super_interest: false, message: 'Hi! I saw your profile and would love to connect.' },
  { id: 'r2', name: 'Ananya Gupta', age: 25, city: 'Delhi', occupation: 'Doctor', photo: 'https://randomuser.me/api/portraits/women/68.jpg', status: 'accepted', is_super_interest: true, message: 'You seem like a wonderful person!' },
  { id: 'r3', name: 'Simran Kaur', age: 28, city: 'Chandigarh', occupation: 'Lawyer', photo: 'https://randomuser.me/api/portraits/women/65.jpg', status: 'pending', is_super_interest: false },
];

const MOCK_SENT: MockInterest[] = [
  { id: 's1', name: 'Nisha Reddy', age: 26, city: 'Bangalore', occupation: 'Data Scientist at Google', photo: 'https://randomuser.me/api/portraits/women/47.jpg', status: 'pending', is_super_interest: false },
  { id: 's2', name: 'Riya Joshi', age: 29, city: 'Pune', occupation: 'Marketing Manager', photo: 'https://randomuser.me/api/portraits/women/26.jpg', status: 'accepted', is_super_interest: true, message: 'Your profile caught my eye!' },
  { id: 's3', name: 'Meera Patel', age: 24, city: 'Ahmedabad', occupation: 'UX Designer', photo: 'https://randomuser.me/api/portraits/women/90.jpg', status: 'declined', is_super_interest: false },
];

const MOCK_MUTUAL: MockInterest[] = [
  { id: 'm_r2', name: 'Ananya Gupta', age: 25, city: 'Delhi', occupation: 'Doctor at AIIMS', photo: 'https://randomuser.me/api/portraits/women/68.jpg', status: 'accepted', is_super_interest: true, threadId: 'thread_ananya' },
  { id: 'm_s2', name: 'Riya Joshi', age: 29, city: 'Pune', occupation: 'Marketing Manager', photo: 'https://randomuser.me/api/portraits/women/26.jpg', status: 'accepted', is_super_interest: true, threadId: 'thread_riya' },
];

function statusColor(status: InterestStatus): string {
  switch (status) {
    case 'accepted': return colors.success ?? '#4CAF50';
    case 'declined': return colors.error ?? '#F44336';
    case 'withdrawn': return colors.gray[500];
    default: return colors.gold ?? '#FFC107';
  }
}

function statusLabel(status: InterestStatus): string {
  switch (status) {
    case 'accepted': return 'Accepted ✓';
    case 'declined': return 'Declined';
    case 'withdrawn': return 'Withdrawn';
    default: return 'Pending';
  }
}

export default function InterestsScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('received');
  const router = useRouter();
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set(['r2', 's2']));
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set(['s3']));

  const activeData = useMemo(() => {
    switch (activeTab) {
      case 'received': return MOCK_RECEIVED;
      case 'sent': return MOCK_SENT;
      case 'mutual': return MOCK_MUTUAL;
    }
  }, [activeTab]);

  const handleAccept = useCallback((id: string) => {
    setAcceptedIds((prev) => new Set([...prev, id]));
  }, []);

  const handleDecline = useCallback((id: string) => {
    setDeclinedIds((prev) => new Set([...prev, id]));
  }, []);

  const getStatus = useCallback((item: MockInterest): InterestStatus => {
    if (acceptedIds.has(item.id)) return 'accepted';
    if (declinedIds.has(item.id)) return 'declined';
    return item.status;
  }, [acceptedIds, declinedIds]);

  const renderInterest = useCallback(
    ({ item }: { item: MockInterest }) => {
      const currentStatus = getStatus(item);
      return (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Image source={{ uri: item.photo }} style={styles.avatar} />
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.is_super_interest && (
                  <Ionicons name="star" size={14} color={colors.gold ?? '#FFC107'} style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={styles.cardMeta}>{item.age} yrs • {item.city}</Text>
              <Text style={styles.cardOccupation}>{item.occupation}</Text>
              {item.message ? (
                <Text style={styles.cardMessage} numberOfLines={2}>"{item.message}"</Text>
              ) : null}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(currentStatus) + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor(currentStatus) }]}>
                {statusLabel(currentStatus)}
              </Text>
            </View>
          </View>
          {activeTab === 'received' && currentStatus === 'pending' && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(item.id)}>
                <Ionicons name="close" size={16} color={colors.error ?? '#F44336'} />
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.id)}>
                <Ionicons name="checkmark" size={16} color={colors.white} />
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}
          {activeTab === 'mutual' && (
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => router.push(`/(tabs)/messages/${item.threadId ?? 'thread_ananya'}` as never)}
            >
              <Ionicons name="chatbubble-outline" size={16} color={colors.white} />
              <Text style={styles.chatText}>Start Chat</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [activeTab, getStatus, handleAccept, handleDecline],
  );

  const keyExtractor = useCallback((item: MockInterest) => item.id, []);

  const emptyMessage = useMemo(() => {
    switch (activeTab) {
      case 'received': return 'No interests received yet. Complete your profile to attract more matches.';
      case 'sent': return "You haven't sent any interests yet. Browse matches to get started.";
      case 'mutual': return 'No mutual interests yet. Keep connecting!';
    }
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Interests</Text>

      <View style={styles.tabs}>
        {TAB_OPTIONS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={activeData}
        renderItem={renderInterest}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={56} color={colors.gray[300]} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  title: { fontSize: fonts.sizes['2xl'], fontWeight: '700', color: colors.deep, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.creamDark, borderRadius: borderRadius.md, padding: spacing.xs },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.sm },
  tabActive: { backgroundColor: colors.white, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  tabText: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.gray[500] },
  tabTextActive: { color: colors.rose },
  list: { padding: spacing.md, paddingBottom: spacing['2xl'] },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.creamDark },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  cardName: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.deep },
  cardMeta: { fontSize: fonts.sizes.sm, color: colors.gray[600], marginTop: 2 },
  cardOccupation: { fontSize: fonts.sizes.xs, color: colors.gray[500], marginTop: 2 },
  cardMessage: { fontSize: fonts.sizes.sm, color: colors.gray[500], fontStyle: 'italic', marginTop: spacing.xs },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm, marginLeft: spacing.sm },
  statusText: { fontSize: fonts.sizes.xs, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray[200], gap: spacing.sm },
  declineBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.error ?? '#F44336' },
  declineText: { fontSize: fonts.sizes.sm, color: colors.error ?? '#F44336', marginLeft: spacing.xs, fontWeight: '600' },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.sage ?? '#4CAF50' },
  acceptText: { fontSize: fonts.sizes.sm, color: colors.white, marginLeft: spacing.xs, fontWeight: '600' },
  chatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.rose, gap: spacing.xs },
  chatText: { fontSize: fonts.sizes.sm, color: colors.white, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: spacing['2xl'] },
  emptyText: { fontSize: fonts.sizes.md, color: colors.gray[500], textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.xl },
});
