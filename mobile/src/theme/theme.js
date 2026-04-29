import { colors } from './colors';
import { spacing, borderRadius } from './spacing';
import { typography } from './typography';

export const theme = {
  colors,
  spacing,
  borderRadius: {
    ...borderRadius,
    card: 16,
    button: 14,
    chip: 999,
  },
  typography,
  shadow: {
    card: {
      shadowColor: colors.navy,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    soft: {
      shadowColor: colors.navy,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
  },
};

export default theme;
