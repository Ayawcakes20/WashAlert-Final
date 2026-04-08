import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const LoadingSkeleton = ({ width = '100%', height = 20, style, count = 1, gap = 8 }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.skeleton,
            {
              width,
              height,
              marginBottom: index < count - 1 ? gap : 0,
            },
            style,
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
});

export default LoadingSkeleton;