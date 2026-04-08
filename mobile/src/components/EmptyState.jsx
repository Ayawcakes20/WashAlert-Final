import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const EmptyState = ({ title, description, message, icon, action, actionButton }) => {
  return (
    <View style={styles.container}>
      {icon ? (
        typeof icon === 'string' ? (
          <MaterialCommunityIcons name={icon} size={56} color={colors.border} />
        ) : (
          <View style={styles.iconContainer}>{icon}</View>
        )
      ) : (
        <MaterialCommunityIcons name="package-variant" size={56} color={colors.border} />
      )}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {(description || message) ? (
        <Text style={styles.description}>{description || message}</Text>
      ) : null}
      {action || actionButton ? (
        <View style={styles.actionContainer}>{action || actionButton}</View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionContainer: {
    marginTop: 16,
  },
});

export default EmptyState;