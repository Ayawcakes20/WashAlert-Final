import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const Button = ({ 
  label,
  title, 
  onPress, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  style,
  textStyle
}) => {
  const styles = getStyles(variant, size, disabled);

  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, textStyle]}>
        {label || title}
      </Text>
    </TouchableOpacity>
  );
};

const getStyles = (variant, size, disabled) => {
  const baseStyle = {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
  };

  const normalizedSize = 
    size === 'small' ? 'sm' : 
    size === 'medium' ? 'md' : 
    size === 'large' ? 'lg' : 
    size;

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 12 },
    md: { paddingVertical: 12, paddingHorizontal: 16 },
    lg: { paddingVertical: 16, paddingHorizontal: 20 },
  };

  const variantStyles = {
    primary: {
      backgroundColor: colors.primary,
      textColor: '#FFFFFF',
    },
    secondary: {
      backgroundColor: colors.secondary,
      textColor: '#FFFFFF',
    },
    accent: {
      backgroundColor: colors.accent,
      textColor: '#FFFFFF',
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.primary,
      textColor: colors.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
      textColor: colors.primary,
    },
  };

  const variant_style = variantStyles[variant] || variantStyles.primary;

  return StyleSheet.create({
    button: {
      ...baseStyle,
      ...sizeStyles[normalizedSize],
      backgroundColor: disabled ? colors.disabled : variant_style.backgroundColor,
      borderWidth: variant_style.borderWidth || 0,
      borderColor: variant_style.borderColor || 'transparent',
    },
    text: {
      color: disabled ? colors.textTertiary : variant_style.textColor,
      fontSize: normalizedSize === 'sm' ? 14 : normalizedSize === 'md' ? 16 : 18,
      fontWeight: '600',
    },
  });
};

export default Button;