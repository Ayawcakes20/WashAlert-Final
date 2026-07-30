import { StyleSheet, Dimensions } from 'react-native';
import { colors } from '../../theme/colors';

const { width } = Dimensions.get('window');
const SVC_CARD_W = 148;

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },

  // ─── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerLogo: { width: 36, height: 36, borderRadius: 18 },  // fully circular like Image 2
  headerTitle: { fontSize: 19, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  // ─── Hero White Card ──────────────────────────────────────────────────────
  heroCard: {
    marginHorizontal: 16, borderRadius: 26,
    backgroundColor: colors.surface,
    paddingTop: 20, paddingBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },

  // ─── Announcement Banner ──────────────────────────────────────────────────
  announcementCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 16,
    backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B',
    padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  announcementIconBox: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center',
  },
  announcementContent: { flex: 1 },
  announcementTag: { fontSize: 10, fontWeight: '800', color: '#D97706', textTransform: 'uppercase', marginBottom: 2 },
  announcementTitle: { fontSize: 14, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  announcementMessage: { fontSize: 12, fontWeight: '500', color: '#78350F', lineHeight: 17 },
  greetPad: { paddingHorizontal: 20, marginBottom: 16 },
  greetLine1: { fontSize: 16, fontWeight: '600', color: colors.text },
  greetName: { color: colors.text, fontWeight: '800' },
  greetAccent: { color: colors.accent, fontWeight: '700' },
  greetTitle: {
    fontSize: 22, fontWeight: '900', color: colors.text,
    letterSpacing: -0.5, lineHeight: 28, marginTop: 3,
  },

  // ─── Service Cards (horizontal) ───────────────────────────────────────────
  svcList: { paddingHorizontal: 20, gap: 10 },
  svcCard: {
    width: SVC_CARD_W, borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  svcImg: { width: '100%', height: 100 },
  svcBottom: { padding: 12 },
  svcTagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  svcTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  svcTagTxt: { fontSize: 10, fontWeight: '800' },
  svcArrowBtn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  svcPrice: { fontSize: 12, color: colors.accent, fontWeight: '700', marginBottom: 2 },
  svcName: { fontSize: 13, fontWeight: '800', color: colors.text },
  // "See all" arrow card
  svcSeeAll: {
    width: 60, borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  // "View Package Details & Inclusions" button below service cards
  servicesDetailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginHorizontal: 20, marginTop: 12, marginBottom: 4,
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  servicesDetailBtnTxt: {
    fontSize: 13, fontWeight: '600', color: colors.primary, flex: 1, textAlign: 'center',
  },

  // ─── Scroll container sits on dark navy bg ────────────────────────────────
  scroll: { flex: 1, backgroundColor: colors.primary },

  // ─── Light body sheet follows hero card ───────────────────────────────────
  bodySheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    marginTop: 18, paddingHorizontal: 20,
    paddingTop: 24, paddingBottom: 110,
    minHeight: 400,
  },

  // ─── Section header ───────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.4 },
  seeAllTxt: { fontSize: 13, color: colors.accent, fontWeight: '700' },

  // ─── Active Order Card ────────────────────────────────────────────────────
  activeCard: {
    borderRadius: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, marginBottom: 24,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    overflow: 'hidden',
  },
  activeStrip: { height: 4, backgroundColor: colors.primary },
  activeBody: { padding: 16 },
  activeTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primaryLight, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  activeBadgeTxt: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.7 },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, paddingHorizontal: 13,
    paddingVertical: 6, borderRadius: 20,
  },
  trackBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  activeHeadline: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 3 },
  activeSubline: { fontSize: 12, color: colors.textSecondary, fontWeight: '500', marginBottom: 14 },

  // Progress bar
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  stepDot: {
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotCurrent: { backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.primaryLight },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border },
  stepLineActive: { backgroundColor: colors.primary },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLbl: { fontSize: 9, color: colors.textTertiary, fontWeight: '500', flex: 1, textAlign: 'center' },
  progressLblActive: { color: colors.primary, fontWeight: '700' },

  // Detail pill (View Details only)
  detailPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12,
    paddingVertical: 9, backgroundColor: colors.primaryLight, marginTop: 14,
  },
  detailPillTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // ─── Branches ─────────────────────────────────────────────────────────────
  branchesWrap: { marginBottom: 24 },
  branchTabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  branchTab: {
    flex: 1, paddingVertical: 9, borderRadius: 12,
    alignItems: 'center', backgroundColor: colors.surfaceVariant,
    borderWidth: 1, borderColor: colors.border,
  },
  branchTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  branchTabTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  branchTabTxtActive: { color: '#fff' },
  brandBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primaryLight, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  brandLogo: { width: 38, height: 38, borderRadius: 9 },
  brandName: { fontSize: 14, fontWeight: '800', color: colors.primary },
  brandMeta: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', marginTop: 1 },
  brandHours: { fontSize: 10, color: colors.success, fontWeight: '700', marginTop: 2 },
  branchItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  branchNumBox: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  branchNum: { fontSize: 11, fontWeight: '800', color: colors.primary },
  branchName: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 },
  branchAddr: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', lineHeight: 16, flex: 1 },

  // ─── Recent Orders ────────────────────────────────────────────────────────
  ordersWrap: { marginBottom: 24 },
  orderCard: {
    backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden',
    flexDirection: 'row', borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 10,
  },
  orderBar: { width: 4 },
  orderInner: { flex: 1, padding: 14 },
  orderTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8,
  },
  orderId: { fontSize: 14, fontWeight: '700', color: colors.text },
  orderDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderAmt: { fontSize: 19, fontWeight: '900', color: colors.primary },
  chevronBox: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },

  // ─── Empty / Refresh ──────────────────────────────────────────────────────
  emptyBox: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyTxt: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  emptyDesc: { fontSize: 12, color: colors.textTertiary, fontWeight: '500' },
  refreshRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 10,
  },
  refreshTxt: { fontSize: 12, color: colors.textTertiary, fontWeight: '600' },
});

export default S;
