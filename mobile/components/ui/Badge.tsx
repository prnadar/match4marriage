import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '@/lib/theme';

type BadgeVariant = 'primary' | 'gold' | 'sage' | 'error' | 'gray';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const BG: Record<BadgeVariant, string> = {
  primary: colors.rose,
  gold: colors.gold,
  sage: colors.sage,
  error: colors.error,
  gray: colors.gray[200],
};

const FG: Record<BadgeVariant, string> = {
  primary: colors.white,
  gold: colors.white,
  sage: colors.white,
  error: colors.white,
  gray: colors.gray[700],
};

export default function Badge({ label, variant = 'primary', size = 'md' }: BadgeProps) {
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: BG[variant],
          paddingHorizontal: isSmall ? spacing.sm : spacing.sm + 4,
          paddingVertical: isSmall ? 2 : spacing.xs,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: FG[variant],
            fontSize: isSmall ? fonts.sizes.xs : fonts.sizes.sm,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});
