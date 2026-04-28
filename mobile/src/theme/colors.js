const colors = {
  navy: "#0F2A44",
  navyDark: "#081C33",
  navyLight: "#173B63",
  mint: "#2ED1C1",
  mintSoft: "#E8FBF8",
  mintLight: "#BFF5EE",
  gold: "#F5C542",
  goldSoft: "#FFF7D6",
  white: "#FFFFFF",
  background: "#F7F9FC",
  surface: "#FFFFFF",
  border: "#E5EAF0",
  text: "#111827",
  textMuted: "#6B7280",
  textLight: "#94A3B8",
  success: "#22C55E",
  warning: "#F5C542",
  danger: "#EF4444",
  info: "#3B82F6",
  purple: "#8B5CF6",
  pending: "#F5C542",
  washing: "#3B82F6",
  drying: "#2ED1C1",
  ready: "#22C55E",
  delivering: "#8B5CF6",
  delivered: "#16A34A",
  cancelled: "#EF4444",
};

// Backward-compatible aliases used by existing screens.
colors.primary = colors.navy;
colors.primaryDark = colors.navyDark;
colors.primaryLight = colors.mintSoft;
colors.secondary = colors.mint;
colors.accent = colors.gold;
colors.card = colors.surface;
colors.surfaceVariant = colors.mintSoft;
colors.disabled = colors.textLight;
colors.textSecondary = colors.textMuted;
colors.textTertiary = colors.textLight;
colors.error = colors.danger;
colors.errorLight = "#FEE2E2";
colors.successLight = "#DCFCE7";
colors.warningLight = colors.goldSoft;
colors.infoLight = "#DBEAFE";

export { colors };
export default colors;
