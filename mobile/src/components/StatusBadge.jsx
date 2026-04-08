import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const StatusBadge = ({ status, style }) => {
  const getStatusColors = () => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'active':
      case 'in-progress':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'completed':
        return { bg: '#DCFCE7', text: '#15803D' };
      case 'cancelled':
        return { bg: '#FEE2E2', text: '#991B1B' };
      case 'delivering':
        return { bg: '#E0E7FF', text: '#3730A3' };
      default:
        return { bg: colors.border, text: colors.text };
    }
  };

  const statusColors = getStatusColors();

  return (
    <View style={[styles.badge, { backgroundColor: statusColors.bg }, style]}>
      <Text style={[styles.text, { color: statusColors.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.small.fontSize,
    fontWeight: typography.smallBold.fontWeight,
  },
});

export default StatusBadge;