import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';

type Step = 'phone' | 'otp';
const OTP_LENGTH = 6;
const RESEND_DELAY_SECONDS = 30;

// Demo mode: allows testers to use a demo account
// Demo phone: 9999999999, OTP: 000000
const DEMO_PHONE = '9999999999';
const DEMO_OTP = '000000';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const otpRefs = useRef<(TextInput | null)[]>([]);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendOtp = useCallback(async () => {
    const trimmedPhone = phone.trim();
    if (trimmedPhone.length !== 10 || !/^\d{10}$/.test(trimmedPhone)) {
      setErrorMessage('Please enter a valid 10-digit phone number');
      return;
    }

    // Demo mode bypass — keep existing demo account behaviour
    if (trimmedPhone === DEMO_PHONE) {
      setStep('otp');
      setOtp(DEMO_OTP.split(''));
      setResendTimer(0);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const fullPhone = `+91${trimmedPhone}`;
      const result = await signInWithPhoneNumber(firebaseAuth, fullPhone);
      setConfirmationResult(result);
      setStep('otp');
      setResendTimer(RESEND_DELAY_SECONDS);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      const message = firebaseErr?.message || 'Failed to send OTP. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [phone]);

  const handleVerifyOtp = useCallback(async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== OTP_LENGTH) {
      setErrorMessage('Please enter the complete 6-digit OTP');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Demo mode: fall back to existing Twilio/demo OTP path
      if (phone.trim() === DEMO_PHONE) {
        const response = await authApi.verifyOtp(phone.trim(), otpValue, '+91');
        const data = response.data.data;
        if (!data) {
          setErrorMessage('Verification failed. Please try again.');
          return;
        }
        await setAuth(data.access_token, data.user_id, data.is_new_user);
        if (data.is_new_user) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace('/(tabs)');
        }
        return;
      }

      // Firebase phone auth path
      if (!confirmationResult) {
        setErrorMessage('Session expired. Please request a new OTP.');
        return;
      }

      const userCredential = await confirmationResult.confirm(otpValue);
      const idToken = await userCredential.user.getIdToken();

      // Exchange Firebase ID token for backend session token
      const response = await authApi.firebaseVerify(idToken);
      const data = response.data.data;
      if (!data) {
        setErrorMessage('Verification failed. Please try again.');
        return;
      }

      await setAuth(data.access_token, data.user_id, data.is_new_user);

      if (data.is_new_user) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } }; message?: string; code?: string };
      const serverMsg = axiosErr?.response?.data?.error || axiosErr?.response?.data?.message;
      const message = serverMsg || axiosErr?.message || 'Invalid OTP. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [otp, phone, confirmationResult, setAuth, router]);

  const handleResendOtp = useCallback(async () => {
    if (resendTimer > 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (phone.trim() === DEMO_PHONE) {
        // Demo mode: use existing backend resend
        await authApi.resendOtp(phone.trim(), '+91');
      } else {
        // Firebase path: re-trigger signInWithPhoneNumber
        const fullPhone = `+91${phone.trim()}`;
        const result = await signInWithPhoneNumber(firebaseAuth, fullPhone);
        setConfirmationResult(result);
      }
      setResendTimer(RESEND_DELAY_SECONDS);
      Alert.alert('OTP Sent', 'A new OTP has been sent to your phone.');
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      const message = firebaseErr?.message || 'Failed to resend OTP.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, resendTimer]);

  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      const digit = text.replace(/[^0-9]/g, '').slice(-1);
      const updatedOtp = otp.map((d, i) => (i === index ? digit : d));
      setOtp(updatedOtp);

      if (digit && index < OTP_LENGTH - 1) {
        otpRefs.current[index + 1]?.focus();
      }
    },
    [otp]
  );

  const handleOtpKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !otp[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    },
    [otp]
  );

  const handleBackToPhone = useCallback(() => {
    setStep('phone');
    setOtp(Array(OTP_LENGTH).fill(''));
    setErrorMessage(null);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.accentBar} />
          <Text style={styles.logoText}>Match4Marriage</Text>
          <Text style={styles.tagline}>बंधन · The Sacred Bond</Text>
        </View>

        {step === 'phone' ? (
          <View style={styles.formArea}>
            <Text style={styles.heading}>Welcome</Text>
            <Text style={styles.subheading}>
              Enter your phone number to get started
            </Text>

            <View style={styles.phoneRow}>
              <View style={styles.prefixBox}>
                <Text style={styles.prefixText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="10-digit phone number"
                placeholderTextColor={colors.gray[400]}
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={(t) => {
                  setPhone(t.replace(/[^0-9]/g, ''));
                  setErrorMessage(null);
                }}
              />
            </View>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Send OTP</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => {
                setPhone(DEMO_PHONE);
                setStep('otp');
                setOtp(DEMO_OTP.split(''));
                setResendTimer(0);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="play-circle-outline" size={20} color={colors.rose} />
              <Text style={styles.demoButtonText}>Try Demo Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formArea}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackToPhone}>
              <Ionicons name="arrow-back" size={20} color={colors.rose} />
              <Text style={styles.backText}>Change number</Text>
            </TouchableOpacity>

            <Text style={styles.heading}>Verify OTP</Text>
            <Text style={styles.subheading}>
              Enter the 6-digit code sent to +91 {phone}
            </Text>

            {phone === DEMO_PHONE && (
              <View style={styles.demoHint}>
                <Ionicons name="information-circle" size={16} color={colors.sage} />
                <Text style={styles.demoHintText}>Demo account — tap Verify to continue</Text>
              </View>
            )}

            <View style={styles.otpRow}>
              {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => {
                    otpRefs.current[i] = ref;
                  }}
                  style={[
                    styles.otpBox,
                    otp[i] ? styles.otpBoxFilled : null,
                  ]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={otp[i]}
                  onChangeText={(t) => handleOtpChange(t, i)}
                  onKeyPress={({ nativeEvent }) =>
                    handleOtpKeyPress(nativeEvent.key, i)
                  }
                  autoFocus={i === 0}
                />
              ))}
            </View>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendOtp}
              disabled={resendTimer > 0 || isSubmitting}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.resendText,
                  resendTimer > 0 && styles.resendDisabled,
                ]}
              >
                {resendTimer > 0
                  ? `Resend OTP in ${resendTimer}s`
                  : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  accentBar: {
    width: 48,
    height: 4,
    backgroundColor: colors.rose,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: fonts.sizes['4xl'],
    fontWeight: '700',
    color: colors.rose,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: fonts.sizes.md,
    color: colors.gold,
    marginTop: spacing.xs,
  },
  formArea: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heading: {
    fontSize: fonts.sizes['2xl'],
    fontWeight: '700',
    color: colors.deep,
    marginBottom: spacing.xs,
  },
  subheading: {
    fontSize: fonts.sizes.md,
    color: colors.gray[600],
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[200],
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: fonts.sizes.sm,
    color: colors.gray[400],
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.rose,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  demoButtonText: {
    fontSize: fonts.sizes.md,
    fontWeight: '600',
    color: colors.rose,
  },
  demoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  demoHintText: {
    fontSize: fonts.sizes.sm,
    color: colors.sage,
    fontWeight: '500',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  prefixBox: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  prefixText: {
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
    color: colors.deep,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: fonts.sizes.lg,
    color: colors.deep,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.sm,
    textAlign: 'center',
    fontSize: fonts.sizes.xl,
    fontWeight: '600',
    color: colors.deep,
    backgroundColor: colors.white,
  },
  otpBoxFilled: {
    borderColor: colors.rose,
    backgroundColor: colors.cream,
  },
  primaryButton: {
    backgroundColor: colors.rose,
    paddingVertical: 15,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: '700',
  },
  errorText: {
    color: colors.error,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backText: {
    color: colors.rose,
    fontSize: fonts.sizes.sm,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  resendText: {
    color: colors.rose,
    fontSize: fonts.sizes.md,
    fontWeight: '600',
  },
  resendDisabled: {
    color: colors.gray[400],
  },
});
