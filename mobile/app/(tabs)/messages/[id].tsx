import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import { MOCK_THREADS } from './index';

interface MockMessage {
  id: string;
  text: string;
  isMine: boolean;
  time: string;
}

const MOCK_MESSAGES: Record<string, MockMessage[]> = {
  thread_ananya: [
    { id: '1', text: 'Hi! I saw your profile and would love to connect 😊', isMine: false, time: '2:20 PM' },
    { id: '2', text: 'Hey Ananya! Thanks for reaching out. Your profile is impressive!', isMine: true, time: '2:22 PM' },
    { id: '3', text: 'Thank you! I loved reading about your work. What do you do for fun?', isMine: false, time: '2:25 PM' },
    { id: '4', text: 'I enjoy hiking and cooking. You?', isMine: true, time: '2:27 PM' },
    { id: '5', text: 'Would love to know more about you!', isMine: false, time: '2:30 PM' },
  ],
  thread_riya: [
    { id: '1', text: 'Hi! I noticed you accepted my interest 🙏', isMine: false, time: '11:00 AM' },
    { id: '2', text: 'Yes! Your profile stood out. Marketing + Wipro, impressive!', isMine: true, time: '11:05 AM' },
    { id: '3', text: 'Thank you for accepting my interest 😊', isMine: false, time: '11:15 AM' },
  ],
  thread_priya: [
    { id: '1', text: 'Hi! I saw your profile and loved it', isMine: false, time: 'Yesterday' },
    { id: '2', text: 'Hello Priya! Nice to hear from you 😊', isMine: true, time: 'Yesterday' },
  ],
};

const DEFAULT_MESSAGES: MockMessage[] = [
  { id: 'default_1', text: 'Hi there! 👋', isMine: false, time: 'Just now' },
];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<MockMessage[]>(
    MOCK_MESSAGES[id ?? ''] ?? DEFAULT_MESSAGES
  );
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList<MockMessage>>(null);

  const thread = MOCK_THREADS.find((t) => t.id === id);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    const newMsg: MockMessage = {
      id: `msg_${Date.now()}`,
      text: trimmed,
      isMine: true,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Auto-reply after 1.5s for demo feel
    setTimeout(() => {
      const replies = [
        'That sounds lovely! 😊',
        'I completely agree!',
        'Tell me more about that!',
        'You seem like a wonderful person ❤️',
        'I would love to know more about your family too!',
      ];
      const reply: MockMessage = {
        id: `reply_${Date.now()}`,
        text: replies[Math.floor(Math.random() * replies.length)],
        isMine: false,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, reply]);
    }, 1500);
  }, [inputText]);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages.length]);

  const renderMessage = useCallback(
    ({ item }: { item: MockMessage }) => (
      <View style={[styles.bubbleRow, item.isMine && styles.bubbleRowMine]}>
        <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, item.isMine && styles.bubbleTextMine]}>
            {item.text}
          </Text>
          <Text style={[styles.bubbleTime, item.isMine && styles.bubbleTimeMine]}>
            {item.time}
            {item.isMine && (
              <Text>  <Ionicons name="checkmark-done" size={12} color={item.isMine ? 'rgba(255,255,255,0.7)' : colors.gray[400]} /></Text>
            )}
          </Text>
        </View>
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: MockMessage) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.deep} />
        </TouchableOpacity>
        {thread ? (
          <Image source={{ uri: thread.photo }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, { backgroundColor: colors.creamDark, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="person" size={20} color={colors.gray[400]} />
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{thread?.name ?? 'Chat'}</Text>
          <Text style={styles.headerStatus}>● Online</Text>
        </View>
        <TouchableOpacity style={styles.headerAction}>
          <Ionicons name="call-outline" size={22} color={colors.rose} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.gray[400]}
            value={inputText}
            onChangeText={setInputText}
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[200],
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.deep },
  headerStatus: { fontSize: fonts.sizes.xs, color: '#4CAF50', marginTop: 1 },
  headerAction: { padding: spacing.xs },
  messageList: { padding: spacing.md, paddingBottom: spacing.sm },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.sm, justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg, backgroundColor: colors.white,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  bubbleMine: { backgroundColor: colors.rose, borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: fonts.sizes.md, color: colors.deep, lineHeight: 20 },
  bubbleTextMine: { color: colors.white },
  bubbleTime: { fontSize: 11, color: colors.gray[400], marginTop: 4, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray[200],
    gap: spacing.sm,
  },
  input: {
    flex: 1, backgroundColor: colors.creamDark, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: fonts.sizes.md, color: colors.deep, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.rose, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
