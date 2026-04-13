import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { profileApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';
import type { Gender, Religion } from '@/types';

const TOTAL_STEPS = 4;

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

const RELIGION_OPTIONS: { label: string; value: Religion }[] = [
  { label: 'Hindu', value: 'hindu' },
  { label: 'Muslim', value: 'muslim' },
  { label: 'Christian', value: 'christian' },
  { label: 'Sikh', value: 'sikh' },
  { label: 'Jain', value: 'jain' },
  { label: 'Buddhist', value: 'buddhist' },
  { label: 'Parsi', value: 'parsi' },
  { label: 'Other', value: 'other' },
];

interface FormData {
  first_name: string;
  last_name: string;
  gender: Gender | '';
  date_of_birth: string;
  religion: Religion | '';
  caste: string;
  mother_tongue: string;
  education_level: string;
  occupation: string;
  employer: string;
  annual_income_inr: string;
  bio: string;
}

const INITIAL_FORM: FormData = {
  first_name: '',
  last_name: '',
  gender: '',
  date_of_birth: '',
  religion: '',
  caste: '',
  mother_tongue: '',
  education_level: '',
  occupation: '',
  employer: '',
  annual_income_inr: '',
  bio: '',
};

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            i < current ? styles.progressFilled : styles.progressEmpty,
            i < total - 1 ? styles.progressGap : null,
          ]}
        />
      ))}
    </View>
  );
}

function ChipSelector<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: T }[];
  selected: T | '';
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.chip,
            selected === opt.value ? styles.chipSelected : null,
          ]}
          onPress={() => onSelect(opt.value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.chipText,
              selected === opt.value ? styles.chipTextSelected : null,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrorMessage(null);
    },
    []
  );

  const validateStep = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        if (!form.first_name.trim()) {
          setErrorMessage('First name is required');
          return false;
        }
        if (!form.gender) {
          setErrorMessage('Please select your gender');
          return false;
        }
        if (!form.date_of_birth.trim()) {
          setErrorMessage('Date of birth is required (DD/MM/YYYY)');
          return false;
        }
        return true;
      case 2:
        if (!form.religion) {
          setErrorMessage('Please select your religion');
          return false;
        }
        if (!form.mother_tongue.trim()) {
          setErrorMessage('Mother tongue is required');
          return false;
        }
        return true;
      case 3:
        if (!form.education_level.trim()) {
          setErrorMessage('Education level is required');
          return false;
        }
        if (!form.occupation.trim()) {
          setErrorMessage('Occupation is required');
          return false;
        }
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  }, [currentStep, form]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
    setErrorMessage(null);
  }, [validateStep]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
    setErrorMessage(null);
  }, []);

  const handleComplete = useCallback(async () => {
    if (!userId) {
      setErrorMessage('Session expired. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const income = parseInt(form.annual_income_inr, 10);
      await profileApi.updateProfile(userId, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        gender: form.gender as Gender,
        date_of_birth: form.date_of_birth.trim(),
        religion: form.religion as Religion,
        caste: form.caste.trim(),
        mother_tongue: form.mother_tongue.trim(),
        education_level: form.education_level.trim(),
        occupation: form.occupation.trim(),
        employer: form.employer.trim(),
        annual_income_inr: isNaN(income) ? 0 : income,
        bio: form.bio.trim(),
      });

      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, userId, router]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>Basic Information</Text>
            <Text style={styles.stepDescription}>Tell us about yourself</Text>

            <FieldLabel text="First Name *" />
            <TextInput
              style={styles.input}
              placeholder="Enter first name"
              placeholderTextColor={colors.gray[400]}
              value={form.first_name}
              onChangeText={(t) => updateField('first_name', t)}
            />

            <FieldLabel text="Last Name" />
            <TextInput
              style={styles.input}
              placeholder="Enter last name"
              placeholderTextColor={colors.gray[400]}
              value={form.last_name}
              onChangeText={(t) => updateField('last_name', t)}
            />

            <FieldLabel text="Gender *" />
            <ChipSelector
              options={GENDER_OPTIONS}
              selected={form.gender}
              onSelect={(v) => updateField('gender', v)}
            />

            <FieldLabel text="Date of Birth * (DD/MM/YYYY)" />
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.gray[400]}
              value={form.date_of_birth}
              onChangeText={(t) => updateField('date_of_birth', t)}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>Religion & Community</Text>
            <Text style={styles.stepDescription}>
              Help us find compatible matches
            </Text>

            <FieldLabel text="Religion *" />
            <ChipSelector
              options={RELIGION_OPTIONS}
              selected={form.religion}
              onSelect={(v) => updateField('religion', v)}
            />

            <FieldLabel text="Caste" />
            <TextInput
              style={styles.input}
              placeholder="Enter caste (optional)"
              placeholderTextColor={colors.gray[400]}
              value={form.caste}
              onChangeText={(t) => updateField('caste', t)}
            />

            <FieldLabel text="Mother Tongue *" />
            <TextInput
              style={styles.input}
              placeholder="e.g. Hindi, Tamil, Bengali"
              placeholderTextColor={colors.gray[400]}
              value={form.mother_tongue}
              onChangeText={(t) => updateField('mother_tongue', t)}
            />
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.stepTitle}>Education & Career</Text>
            <Text style={styles.stepDescription}>
              Share your professional background
            </Text>

            <FieldLabel text="Education Level *" />
            <TextInput
              style={styles.input}
              placeholder="e.g. B.Tech, MBA, PhD"
              placeholderTextColor={colors.gray[400]}
              value={form.education_level}
              onChangeText={(t) => updateField('education_level', t)}
            />

            <FieldLabel text="Occupation *" />
            <TextInput
              style={styles.input}
              placeholder="e.g. Software Engineer"
              placeholderTextColor={colors.gray[400]}
              value={form.occupation}
              onChangeText={(t) => updateField('occupation', t)}
            />

            <FieldLabel text="Employer" />
            <TextInput
              style={styles.input}
              placeholder="Company name (optional)"
              placeholderTextColor={colors.gray[400]}
              value={form.employer}
              onChangeText={(t) => updateField('employer', t)}
            />

            <FieldLabel text="Annual Income (INR)" />
            <TextInput
              style={styles.input}
              placeholder="e.g. 1200000"
              placeholderTextColor={colors.gray[400]}
              value={form.annual_income_inr}
              onChangeText={(t) =>
                updateField('annual_income_inr', t.replace(/[^0-9]/g, ''))
              }
              keyboardType="number-pad"
            />
          </>
        );
      case 4:
        return (
          <>
            <Text style={styles.stepTitle}>About You</Text>
            <Text style={styles.stepDescription}>
              A brief bio helps matches know you better
            </Text>

            <FieldLabel text="Bio" />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write a few lines about yourself, your interests, and what you're looking for..."
              placeholderTextColor={colors.gray[400]}
              value={form.bio}
              onChangeText={(t) => updateField('bio', t)}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>{form.bio.length}/500</Text>
          </>
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Complete Your Profile</Text>
          <Text style={styles.headerSubtitle}>
            Step {currentStep} of {TOTAL_STEPS}
          </Text>
        </View>

        <ProgressBar current={currentStep} total={TOTAL_STEPS} />

        {/* Step content */}
        <View style={styles.card}>
          {renderStepContent()}

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
        </View>

        {/* Navigation buttons */}
        <View style={styles.buttonRow}>
          {currentStep > 1 ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color={colors.rose} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
            onPress={isLastStep ? handleComplete : handleNext}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isLastStep ? 'Complete Profile' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fonts.sizes['2xl'],
    fontWeight: '700',
    color: colors.deep,
  },
  headerSubtitle: {
    fontSize: fonts.sizes.sm,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: borderRadius.full,
  },
  progressFilled: {
    backgroundColor: colors.rose,
  },
  progressEmpty: {
    backgroundColor: colors.gray[200],
  },
  progressGap: {
    marginRight: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  stepTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: '700',
    color: colors.deep,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: fonts.sizes.md,
    color: colors.gray[600],
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
    color: colors.gray[700],
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fonts.sizes.md,
    color: colors.deep,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  charCount: {
    fontSize: fonts.sizes.xs,
    color: colors.gray[400],
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderColor: colors.rose,
    backgroundColor: colors.cream,
  },
  chipText: {
    fontSize: fonts.sizes.sm,
    color: colors.gray[600],
    fontWeight: '500',
  },
  chipTextSelected: {
    color: colors.rose,
    fontWeight: '700',
  },
  errorText: {
    color: colors.error,
    fontSize: fonts.sizes.sm,
    marginTop: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.rose,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minWidth: 140,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.rose,
    fontSize: fonts.sizes.md,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
});
