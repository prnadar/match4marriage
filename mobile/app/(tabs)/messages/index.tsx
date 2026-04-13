import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';

interface MockThread {
  id: string;
  name: string;
  photo: string;
  lastMessage: string;
  time: string;
  unread: number;
}

export const MOCK_THREADS: MockThread[] = [
  { id: 'thread_ananya', name: 'Ananya Gupta', photo: 'https://randomuser.me/api/portraits/women/68.jpg', lastMessage: 'Would love to know more about you!', time: '2:30 PM', unread: 2 },
  { id: 'thread_riya', name: 'Riya Joshi', photo: 'https://randomuser.me/api/portraits/women/26.jpg', lastMessage: 'Thank you for accepting my interest 😊', time: '11:15 AM', unread: 0 },
  { id: 'thread_priya', name: 'Priya Sharma', photo: 'https://randomuser.me/api/portraits/women/44.jpg', lastMessage: 'Hi! I saw your profile and loved it', time: 'Yesterday', unread: 0 },
];

export default function MessagesListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const threads = useMemo(() => {
    if (!search) return MOCK_THREADS;
    const q = search.toLowerCase();
    return MOCK_THREADS.filter((t) => t.name.toLowerCase().includes(q));
  }, [search]);

  const renderThread = useCallback(
    ({ item }: { item: MockThread }) => {
      const isUnread = item.unread > 0;
      return (
        <TouchableOpacity
          style={styles.threadRow}
          activeOpacity={0.7}
          onPress={() => router.push(`/(tabs)/messages/${item.id}` as never)}
        >
          <Image source={{ uri: item.photo }} style={styles.avatar} />
          <View style={styles.threadInfo}>
            <View style={styles.threadTop}>
              <Text style={[styles.threadName, isUnread && styles.bold]}>{item.name}</Text>
              <Text style={styles.threadTime}>{item.time}</Text>
            </View>
            <View style={styles.threadBottom}>
              <Text style={[styles.threadPreview, isUnread && styles.bold]} numberOfLines={1}>
                {item.lastMessage}
              </Text>
              {isUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [router],
  );

  const keyExtractor = useCallback((item: MockThread) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Messages</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.gray[500]} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations"
          placeholderTextColor={colors.gray[400]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={threads}
        renderItem={renderThread}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={56} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyText}>
              When you match with someone, your conversations will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  title: { fontSize: fonts.sizes['2xl'], fontWeight: '700', color: colors.deep, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.md, marginHorizontal: spacing.md, marginTop: spacing.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1, borderColor: colors.gray[200] },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: fonts.sizes.md, color: colors.deep },
  list: { paddingTop: spacing.sm, paddingBottom: spacing['2xl'] },
  threadRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.creamDark },
  threadInfo: { flex: 1, marginLeft: spacing.md },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadName: { fontSize: fonts.sizes.md, color: colors.deep },
  threadTime: { fontSize: fonts.sizes.xs, color: colors.gray[500] },
  threadBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  threadPreview: { flex: 1, fontSize: fonts.sizes.sm, color: colors.gray[500] },
  bold: { fontWeight: '700', color: colors.deep },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.rose, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginLeft: spacing.sm },
  unreadText: { fontSize: 11, fontWeight: '700', color: colors.white },
  emptyState: { alignItems: 'center', paddingTop: spacing['2xl'] },
  emptyTitle: { fontSize: fonts.sizes.xl, fontWeight: '700', color: colors.deep, marginTop: spacing.md },
  emptyText: { fontSize: fonts.sizes.md, color: colors.gray[500], textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xl },
});
