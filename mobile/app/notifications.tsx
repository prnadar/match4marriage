import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import type { Notification } from '@/types';

const ICON_MAP: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
  interest_received: 'heart',
  interest_accepted: 'checkmark-circle',
  new_message: 'chatbubble',
  match: 'star',
  system: 'notifications',
};

const ICON_COLOR_MAP: Record<Notification['type'], string> = {
  interest_received: colors.rose,
  interest_accepted: colors.success,
  new_message: colors.info,
  match: colors.gold,
  system: colors.gray[600],
};

const MOCK_NOTIFICATIONS: readonly Notification[] = [
  {
    id: '1', type: 'interest_received', title: 'New Interest',
    body: 'Priya sent you an interest request', read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    data: { userId: 'u1' },
  },
  {
    id: '2', type: 'interest_accepted', title: 'Interest Accepted',
    body: 'Ananya accepted your interest!', read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    data: { userId: 'u2' },
  },
  {
    id: '3', type: 'new_message', title: 'New Message',
    body: 'Rahul: Hello! How are you?', read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    data: { threadId: 't1' },
  },
  {
    id: '4', type: 'match', title: 'New Match!',
    body: 'You and Meera are a mutual match!', read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    data: { userId: 'u3' },
  },
  {
    id: '5', type: 'system', title: 'Profile Tip',
    body: 'Complete your profile to get 3x more matches', read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function NotificationItem({
  item,
  onPress,
}: {
  item: Notification;
  onPress: (n: Notification) => void;
}) {
  const iconName = ICON_MAP[item.type];
  const iconColor = ICON_COLOR_MAP[item.type];

  return (
    <TouchableOpacity
      style={[styles.notifItem, !item.read && styles.unreadItem]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifHeader}>
          <Text style={[styles.notifTitle, !item.read && styles.unreadText]}>{item.title}</Text>
          <Text style={styles.timeText}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<readonly Notification[]>(MOCK_NOTIFICATIONS);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handlePress = useCallback((notif: Notification) => {
    // Mark as read immutably
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );

    // Navigate based on type
    const data = notif.data ?? {};
    switch (notif.type) {
      case 'interest_received':
      case 'interest_accepted':
      case 'match':
        if (data.userId) router.push(`/profile/${data.userId}`);
        break;
      case 'new_message':
        // Navigate to chat when available
        break;
      default:
        break;
    }
  }, [router]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => <NotificationItem item={item} onPress={handlePress} />,
    [handlePress],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.deep} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead} disabled={unreadCount === 0}>
          <Text style={[styles.markRead, unreadCount === 0 && styles.markReadDisabled]}>
            Mark All Read
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              When you receive interests, messages, or matches, they will appear here.
            </Text>
          </View>
        }
      />
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
  markRead: { fontSize: fonts.sizes.sm, color: colors.rose, fontWeight: '600' },
  markReadDisabled: { color: colors.gray[400] },
  listContent: { paddingVertical: spacing.sm },
  notifItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.white, marginBottom: 1,
  },
  unreadItem: { borderLeftWidth: 3, borderLeftColor: colors.rose },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { fontSize: fonts.sizes.md, fontWeight: '500', color: colors.deep },
  unreadText: { fontWeight: '700' },
  timeText: { fontSize: fonts.sizes.xs, color: colors.gray[500] },
  notifBody: { fontSize: fonts.sizes.sm, color: colors.gray[600], marginTop: spacing.xs },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rose,
  },
  emptyState: {
    alignItems: 'center', paddingVertical: spacing['2xl'] * 2, paddingHorizontal: spacing.lg,
  },
  emptyTitle: { fontSize: fonts.sizes.lg, fontWeight: '600', color: colors.deep, marginTop: spacing.md },
  emptySubtitle: {
    fontSize: fonts.sizes.sm, color: colors.gray[500], textAlign: 'center', marginTop: spacing.sm,
  },
});
