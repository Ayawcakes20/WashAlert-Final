import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const STATUS_MAP = {
  pending:    { label: 'Pending',    color: colors.warning,   bg: '#FEF3C7' },
  received:   { label: 'Received',   color: colors.info,      bg: '#DBEAFE' },
  washing:    { label: 'Washing',    color: colors.accent,    bg: '#CCFBF1' },
  drying:     { label: 'Drying',     color: colors.accent,    bg: '#CCFBF1' },
  ready:      { label: 'Ready',      color: colors.success,   bg: '#D1FAE5' },
  delivering: { label: 'Delivering', color: colors.primary,   bg: '#E8EEF5' },
  delivered:  { label: 'Completed',  color: colors.success,   bg: '#D1FAE5' },
  completed:  { label: 'Completed',  color: colors.success,   bg: '#D1FAE5' },
  cancelled:  { label: 'Cancelled',  color: colors.error,     bg: '#FEE2E2' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_MAP[status?.toLowerCase()] || {
    label: status || 'Unknown',
    color: colors.textSecondary,
    bg: colors.surfaceVariant,
  };

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default StatusBadge;