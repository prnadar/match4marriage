import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMyProfile } from '@/hooks/useApi';
import { useAuthStore } from '@/store/auth';
import { profileApi } from '@/lib/api';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';

interface Section {
  readonly id: string;
  readonly title: string;
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly fields: readonly { label: string; value: string }[];
}

function buildSections(profile: NonNullable<ReturnType<typeof useMyProfile>['data']>): readonly Section[] {
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;

  return [
    {
      id: 'about',
      title: 'About',
      icon: 'information-circle-outline',
      fields: [{ label: 'Bio', value: profile.bio || 'Not added yet' }],
    },
    {
      id: 'basic',
      title: 'Basic Info',
      icon: 'person-outline',
      fields: [
        { label: 'Age', value: age ? `${age} years` : 'Not set' },
        { label: 'Height', value: profile.height_cm ? `${profile.height_cm} cm` : 'Not set' },
        { label: 'Religion', value: profile.religion ? profile.religion.charAt(0).toUpperCase() + profile.religion.slice(1) : 'Not set' },
        { label: 'Caste', value: profile.caste || 'Not set' },
        { label: 'Mother Tongue', value: profile.mother_tongue || 'Not set' },
        { label: 'Marital Status', value: profile.marital_status ? profile.marital_status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Not set' },
        { label: 'City', value: profile.city ?? 'Not set' },
      ],
    },
    {
      id: 'education',
      title: 'Education & Career',
      icon: 'school-outline',
      fields: [
        { label: 'Education', value: profile.education_level || 'Not set' },
        { label: 'Field', value: profile.education_field || 'Not set' },
        { label: 'College', value: profile.college || 'Not set' },
        { label: 'Occupation', value: profile.occupation || 'Not set' },
        { label: 'Employer', value: profile.employer || 'Not set' },
        { label: 'Annual Income', value: profile.annual_income_inr ? `INR ${(profile.annual_income_inr / 100000).toFixed(1)}L` : 'Not disclosed' },
      ],
    },
    {
      id: 'family',
      title: 'Family',
      icon: 'people-outline',
      fields: [
        { label: 'Details', value: profile.family_details && Object.keys(profile.family_details).length > 0 ? 'Added' : 'Not added yet' },
      ],
    },
    {
      id: 'preferences',
      title: 'Partner Preferences',
      icon: 'heart-outline',
      fields: [
        { label: 'Preferences', value: profile.partner_prefs && Object.keys(profile.partner_prefs).length > 0 ? 'Configured' : 'Not set yet' },
      ],
    },
  ];
}

async function uploadPhotoToCloudinary(
  imageUri: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  // Step 1: get signed upload params from backend
  const uploadParamsResponse = await profileApi.getPhotoUploadUrl(contentType);
  const params = uploadParamsResponse.data.data;
  if (!params) {
    throw new Error('Failed to get upload parameters from server');
  }

  // Step 2: build FormData and POST directly to Cloudinary
  const filename = imageUri.split('/').pop() ?? 'photo.jpg';
  const formData = new FormData();
  // React Native FormData accepts uri/name/type objects
  formData.append('file', { uri: imageUri, name: filename, type: contentType } as unknown as Blob);
  formData.append('api_key', params.api_key);
  formData.append('timestamp', String(params.timestamp));
  formData.append('signature', params.signature);
  formData.append('folder', params.folder);
  formData.append('public_id', params.public_id);

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${params.cloud_name}/${params.resource_type}/upload`;
  const cloudRes = await fetch(cloudinaryUrl, {
    method: 'POST',
    body: formData,
  });

  if (!cloudRes.ok) {
    const errText = await cloudRes.text();
    throw new Error(`Cloudinary upload failed: ${errText}`);
  }

  const cloudData = await cloudRes.json();
  return {
    url: cloudData.secure_url ?? params.url,
    key: cloudData.public_id ?? params.key,
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { data: profile, isLoading, error, refetch } = useMyProfile();
  const subscriptionTier = useAuthStore((s) => s.subscriptionTier);
  const userId = useAuthStore((s) => s.userId);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const sections = profile ? buildSections(profile) : [];

  const handleAddPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library to upload a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const contentType = asset.mimeType ?? 'image/jpeg';

    setIsUploadingPhoto(true);
    try {
      const { url, key } = await uploadPhotoToCloudinary(asset.uri, contentType);
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const existingPhotos = profile?.photos ?? [];
      const normalizedExistingPhotos = existingPhotos.map((photo, index) => ({
        key: photo.key,
        url: photo.url,
        is_primary: Boolean(photo.is_primary),
        approved: photo.approved ?? true,
      }));
      await profileApi.updateProfile(userId, {
        photos: [
          ...normalizedExistingPhotos,
          {
            url,
            key,
            is_primary: normalizedExistingPhotos.length === 0,
            approved: true,
          },
        ],
      });
      // Refresh profile data
      refetch?.();
      Alert.alert('Success', 'Photo uploaded successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload photo. Please try again.';
      Alert.alert('Upload failed', message);
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [profile, userId, refetch]);

  const age = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;

  const tierColors: Record<string, string> = {
    free: colors.gray[500],
    silver: colors.gray[400],
    gold: colors.gold,
    platinum: colors.rose,
  };

  const renderSection = useCallback(
    ({ item }: { item: Section }) => (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name={item.icon} size={18} color={colors.rose} />
            <Text style={styles.sectionTitle}>{item.title}</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        {item.fields.map((f) => (
          <View key={f.label} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <Text style={styles.fieldValue}>{f.value}</Text>
          </View>
        ))}
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: Section) => item.id, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  const headerComponent = (
    <>
      <View style={styles.profileHeader}>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings' as never)}
        >
          <Ionicons name="settings-outline" size={24} color={colors.deep} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.avatarLargeWrapper}
          onPress={handleAddPhoto}
          disabled={isUploadingPhoto}
          activeOpacity={0.8}
        >
          <View style={styles.avatarLarge}>
            {isUploadingPhoto ? (
              <ActivityIndicator size="large" color={colors.rose} />
            ) : profile.photos.length > 0 ? (
              <Image source={{ uri: profile.photos.find((p) => p.is_primary)?.url ?? profile.photos[0]?.url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="camera-outline" size={32} color={colors.gray[400]} />
            )}
          </View>
          <View style={styles.photoAddBadge}>
            <Ionicons name="add-circle" size={24} color={colors.rose} />
          </View>
        </TouchableOpacity>

        <Text style={styles.profileName}>
          {profile.first_name} {profile.last_name}
        </Text>
        <Text style={styles.profileMeta}>
          {age ? `${age} yrs` : ''}{profile.city ? ` | ${profile.city}` : ''}
        </Text>

        <View style={[styles.tierBadge, { backgroundColor: (tierColors[subscriptionTier] ?? colors.gray[500]) + '20' }]}>
          <Text style={[styles.tierText, { color: tierColors[subscriptionTier] ?? colors.gray[500] }]}>
            {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)} Member
          </Text>
        </View>

        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark" size={16} color={colors.sage} />
          <Text style={styles.trustText}>
            Profile {profile.completeness_score}% complete
          </Text>
        </View>
      </View>

      {profile.photos.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="images-outline" size={18} color={colors.rose} />
              <Text style={styles.sectionTitle}>Photos</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.editLink}>Manage</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldValue}>{profile.photos.length} photo(s) uploaded</Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={sections}
        renderItem={renderSection}
        keyExtractor={keyExtractor}
        ListHeaderComponent={headerComponent}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: fonts.sizes.md, color: colors.gray[500], marginTop: spacing.md },
  errorText: { fontSize: fonts.sizes.md, color: colors.error, marginTop: spacing.md },
  list: { paddingBottom: spacing['2xl'] },
  profileHeader: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  settingsBtn: { position: 'absolute', top: spacing.md, right: spacing.md, padding: spacing.sm },
  avatarLargeWrapper: { position: 'relative' },
  avatarLarge: { width: 96, height: 96, borderRadius: borderRadius.full, backgroundColor: colors.creamDark, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: colors.rose, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  photoAddBadge: { position: 'absolute', bottom: 0, right: -4, backgroundColor: colors.white, borderRadius: borderRadius.full },
  profileName: { fontSize: fonts.sizes['2xl'], fontWeight: '700', color: colors.deep, marginTop: spacing.md },
  profileMeta: { fontSize: fonts.sizes.md, color: colors.gray[600], marginTop: spacing.xs },
  tierBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, marginTop: spacing.sm },
  tierText: { fontSize: fonts.sizes.sm, fontWeight: '700' },
  trustRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  trustText: { fontSize: fonts.sizes.sm, color: colors.sage, marginLeft: spacing.xs, fontWeight: '600' },
  section: { backgroundColor: colors.white, marginTop: spacing.sm, padding: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.deep, marginLeft: spacing.sm },
  editLink: { fontSize: fonts.sizes.sm, color: colors.rose, fontWeight: '600' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  fieldLabel: { fontSize: fonts.sizes.md, color: colors.gray[600] },
  fieldValue: { fontSize: fonts.sizes.md, color: colors.deep, fontWeight: '500' },
});
