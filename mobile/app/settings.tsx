import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import { useAuthStore } from '@/store/auth';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

type SettingItemConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
};

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingItem({ icon, label, onPress, trailing, danger }: SettingItemConfig) {
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress && !trailing}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.error : colors.gray[600]} />
      <Text style={[styles.settingLabel, danger && styles.dangerLabel]}>{label}</Text>
      {trailing ?? (
        onPress ? <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} /> : null
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const subscriptionTier = useAuthStore((s) => s.subscriptionTier);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [interestAlerts, setInterestAlerts] = useState(true);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [hideLastSeen, setHideLastSeen] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate Account',
      'Your profile will be hidden from all users. You can reactivate anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => {} },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {} },
      ],
    );
  };

  const tierBadgeVariant = (() => {
    switch (subscriptionTier) {
      case 'gold': return 'gold' as const;
      case 'platinum': return 'primary' as const;
      case 'silver': return 'gray' as const;
      default: return 'gray' as const;
    }
  })();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.deep} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.sectionCard}>
          <SettingItem icon="person-outline" label="Edit Profile" onPress={() => {}} />
          <SettingItem icon="call-outline" label="Change Phone" onPress={() => {}} />
          <SettingItem icon="mail-outline" label="Email Verification" onPress={() => {}} />
        </View>

        {/* Privacy */}
        <SectionHeader title="Privacy" />
        <View style={styles.sectionCard}>
          <SettingItem icon="eye-outline" label="Profile Visibility" onPress={() => {}} />
          <SettingItem icon="ban-outline" label="Block List" onPress={() => {}} />
          <SettingItem
            icon="time-outline"
            label="Hide Last Seen"
            trailing={
              <Switch
                value={hideLastSeen}
                onValueChange={setHideLastSeen}
                trackColor={{ true: colors.rose, false: colors.gray[300] }}
              />
            }
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View style={styles.sectionCard}>
          <SettingItem
            icon="notifications-outline"
            label="Push Notifications"
            trailing={
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ true: colors.rose, false: colors.gray[300] }}
              />
            }
          />
          <SettingItem
            icon="mail-outline"
            label="Email Notifications"
            trailing={
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{ true: colors.rose, false: colors.gray[300] }}
              />
            }
          />
          <SettingItem
            icon="heart-outline"
            label="Interest Alerts"
            trailing={
              <Switch
                value={interestAlerts}
                onValueChange={setInterestAlerts}
                trackColor={{ true: colors.rose, false: colors.gray[300] }}
              />
            }
          />
          <SettingItem
            icon="chatbubble-outline"
            label="Message Alerts"
            trailing={
              <Switch
                value={messageAlerts}
                onValueChange={setMessageAlerts}
                trackColor={{ true: colors.rose, false: colors.gray[300] }}
              />
            }
          />
        </View>

        {/* Subscription */}
        <SectionHeader title="Subscription" />
        <View style={styles.sectionCard}>
          <SettingItem
            icon="diamond-outline"
            label="Current Plan"
            trailing={<Badge label={subscriptionTier.toUpperCase()} variant={tierBadgeVariant} size="sm" />}
          />
          <SettingItem
            icon="card-outline"
            label="Manage Subscription"
            onPress={() => router.push('/subscription')}
          />
        </View>

        {/* Support */}
        <SectionHeader title="Support" />
        <View style={styles.sectionCard}>
          <SettingItem icon="help-circle-outline" label="Help Center" onPress={() => {}} />
          <SettingItem icon="bug-outline" label="Report a Bug" onPress={() => {}} />
          <SettingItem icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
          <SettingItem icon="shield-outline" label="Privacy Policy" onPress={() => {}} />
        </View>

        {/* Danger Zone */}
        <SectionHeader title="Danger Zone" />
        <View style={styles.sectionCard}>
          <SettingItem icon="pause-circle-outline" label="Deactivate Account" onPress={handleDeactivate} danger />
          <SettingItem icon="trash-outline" label="Delete Account" onPress={handleDelete} danger />
        </View>

        {/* Logout */}
        <View style={styles.logoutWrap}>
          <Button title="Sign Out" onPress={handleLogout} variant="secondary" icon="log-out-outline" fullWidth />
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
  headerTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['2xl'] },
  sectionHeader: {
    fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.gray[500],
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.white, marginHorizontal: spacing.md,
    borderRadius: borderRadius.md, overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  settingLabel: { flex: 1, fontSize: fonts.sizes.md, color: colors.deep },
  dangerLabel: { color: colors.error },
  logoutWrap: { padding: spacing.lg },
});
