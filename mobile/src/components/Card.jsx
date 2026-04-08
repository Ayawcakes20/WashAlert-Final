import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const Card = ({ children, style, shadow = true }) => {
  return (
    <View style={[styles.card, shadow && styles.cardShadow, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default Card;