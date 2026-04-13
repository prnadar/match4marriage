import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';

type RingSize = 'sm' | 'md' | 'lg';

interface CompatibilityRingProps {
  percentage: number;
  size?: RingSize;
}

const DIMENSION: Record<RingSize, number> = { sm: 40, md: 56, lg: 80 };
const STROKE: Record<RingSize, number> = { sm: 3, md: 4, lg: 5 };
const FONT: Record<RingSize, number> = { sm: fonts.sizes.xs, md: fonts.sizes.sm, lg: fonts.sizes.lg };

export default function CompatibilityRing({ percentage, size = 'md' }: CompatibilityRingProps) {
  const dim = DIMENSION[size];
  const stroke = STROKE[size];
  const radius = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference * (1 - clamped / 100);

  return (
    <View style={[styles.container, { width: dim, height: dim }]}>
      <Svg width={dim} height={dim}>
        <Circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          stroke={colors.gray[200]}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          stroke={colors.gold}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${dim / 2}, ${dim / 2}`}
        />
      </Svg>
      <Text style={[styles.label, { fontSize: FONT[size] }]}>{clamped}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    fontWeight: '700',
    color: colors.gold,
  },
});
