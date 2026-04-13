import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import type { Message } from '@/types';

interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatBubble({ message, isOwn }: ChatBubbleProps) {
  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.text, isOwn ? styles.textOwn : styles.textOther]}>
          {message.encrypted_content}
        </Text>
        <View style={styles.footer}>
          <Text style={[styles.time, isOwn && styles.timeOwn]}>
            {formatTime(message.created_at)}
          </Text>
          {isOwn && (
            <Ionicons
              name={message.read_at ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={message.read_at ? colors.sage : colors.gray[400]}
              style={styles.check}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  rowOwn: {
    alignItems: 'flex-end',
  },
  rowOther: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  bubbleOwn: {
    backgroundColor: '#FCEEE4',
    borderBottomRightRadius: spacing.xs,
  },
  bubbleOther: {
    backgroundColor: colors.gray[100],
    borderBottomLeftRadius: spacing.xs,
  },
  text: {
    fontSize: fonts.sizes.md,
  },
  textOwn: {
    color: colors.deep,
  },
  textOther: {
    color: colors.deep,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  time: {
    fontSize: fonts.sizes.xs,
    color: colors.gray[500],
  },
  timeOwn: {
    color: colors.gray[500],
  },
  check: {
    marginLeft: 4,
  },
});
