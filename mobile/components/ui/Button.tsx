import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'gold';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
}

const HEIGHT: Record<Size, number> = { sm: 36, md: 44, lg: 52 };
const FONT_SIZE: Record<Size, number> = { sm: fonts.sizes.sm, md: fonts.sizes.md, lg: fonts.sizes.lg };
const ICON_SIZE: Record<Size, number> = { sm: 16, md: 20, lg: 24 };
const H_PADDING: Record<Size, number> = { sm: spacing.md, md: spacing.lg, lg: spacing.xl };

const bgColor: Record<Variant, string> = {
  primary: colors.rose,
  secondary: 'transparent',
  ghost: 'transparent',
  gold: colors.gold,
};

const textColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.rose,
  ghost: colors.rose,
  gold: colors.white,
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const containerStyle: ViewStyle[] = [
    styles.base,
    {
      height: HEIGHT[size],
      paddingHorizontal: H_PADDING[size],
      backgroundColor: bgColor[variant],
      borderRadius: borderRadius.md,
    },
    variant === 'secondary' && styles.outlined,
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
  ].filter(Boolean) as ViewStyle[];

  const labelStyle: TextStyle = {
    fontSize: FONT_SIZE[size],
    fontWeight: '600',
    color: textColor[variant],
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor[variant]} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={ICON_SIZE[size]}
              color={textColor[variant]}
              style={styles.icon}
            />
          )}
          <Text style={labelStyle}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: colors.rose,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  icon: {
    marginRight: spacing.sm,
  },
});
