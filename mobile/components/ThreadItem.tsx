import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/lib/theme';
import type { ChatThread } from '@/types';
import Avatar from './ui/Avatar';

interface ThreadItemProps {
  thread: ChatThread;
  onPress: () => void;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ThreadItem({ thread, onPress }: ThreadItemProps) {
  const { other_profile: profile } = thread;
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const photoUrl = profile.photos.find((p) => p.is_primary)?.url ?? profile.photos[0]?.url;
  const hasUnread = thread.unread_count > 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.6}>
      <Avatar name={fullName} photoUrl={photoUrl} size="md" verified={profile.is_verified} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.bold]} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={[styles.time, hasUnread && styles.timeBold]}>
            {formatTime(thread.last_message_at)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text
            style={[styles.preview, hasUnread && styles.previewBold]}
            numberOfLines={1}
          >
            {thread.last_message_preview ?? 'No messages yet'}
          </Text>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {thread.unread_count > 99 ? '99+' : thread.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  body: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  name: { fontSize: fonts.sizes.md, color: colors.deep, flex: 1, marginRight: spacing.sm },
  bold: { fontWeight: '700' },
  time: { fontSize: fonts.sizes.xs, color: colors.gray[500] },
  timeBold: { color: colors.rose, fontWeight: '600' },
  preview: { fontSize: fonts.sizes.sm, color: colors.gray[500], flex: 1, marginRight: spacing.sm },
  previewBold: { color: colors.deep, fontWeight: '600' },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: fonts.sizes.xs,
    color: colors.white,
    fontWeight: '700',
  },
});
