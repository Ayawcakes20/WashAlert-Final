import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { notifications as notificationsApi } from '../../services/api';

const NOTIFICATIONS_PAGE_SIZE = 10;

const getTypeStyle = (type) => {
  switch (type) {
    case 'status':
      return { icon: 'cube-outline', bg: 'hsla(224, 82%, 48%, 0.1)', text: colors.primary };
    case 'delivery':
      return { icon: 'bus-outline', bg: 'hsla(174, 79%, 44%, 0.1)', text: colors.accent };
    case 'payment':
      return { icon: 'card-outline', bg: 'hsla(156, 87%, 34%, 0.1)', text: colors.success };
    case 'promo':
      return { icon: 'megaphone-outline', bg: 'hsla(45, 100%, 80%, 0.5)', text: '#A16207' };
    default:
      return { icon: 'notifications-outline', bg: colors.border, text: colors.textSecondary };
  }
};

const formatTimeLabel = (isoDate) => {
  if (!isoDate) return '';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '';
  const diffMs = Date.now() - parsed.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hr ago`;
  return `${Math.floor(diffMs / day)} day${Math.floor(diffMs / day) > 1 ? 's' : ''} ago`;
};

const NotificationsScreen = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const loadNotifications = useCallback(async (requestedPage = 0, showLoading = true) => {
    try {
      setError('');
      if (showLoading) setLoading(true);
      const data = await notificationsApi.getPaged(requestedPage, NOTIFICATIONS_PAGE_SIZE);
      setItems(data.notifications || []);
      setCurrentPage((data.page || 0) + 1);
      setTotalPages(Math.max(1, data.totalPages || 1));
      setHasNext(Boolean(data.hasNext));
      setHasPrevious(Boolean(data.hasPrevious));
    } catch (loadError) {
      setItems([]);
      setCurrentPage(1);
      setTotalPages(1);
      setHasNext(false);
      setHasPrevious(false);
      setError(loadError?.message || 'Unable to load notifications right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNotifications(0, true);
    }, [loadNotifications]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications(Math.max(0, currentPage - 1), false);
  }, [loadNotifications, currentPage]);

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch {
      // best effort for local read state
    }
  }, []);

  const handleItemPress = (item) => {
    markAsRead(item.id);
    setSelectedNotif(item);
  };

  const markAllRead = useCallback(async () => {
    try {
      const unreadIds = items.filter((item) => !item.read).map((item) => item.id);
      await notificationsApi.markAllAsRead(unreadIds);
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch {
      // best effort for local read state
    }
  }, [items]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <View />
          <TouchableOpacity style={styles.markReadBtn} onPress={markAllRead} disabled={!items.length}>
            <Ionicons
              name="checkmark"
              size={14}
              color={!items.length ? colors.textSecondary : colors.primary}
            />
            <Text style={[styles.markReadText, !items.length && styles.markReadTextDisabled]}>
              Mark all read
            </Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.list}>
          {!items.length ? (
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-off-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No notifications or announcements yet</Text>
              <Text style={styles.emptyText}>You are all caught up.</Text>
            </View>
          ) : (
            items.map((item) => {
              const styleDef = getTypeStyle(item.type);
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => handleItemPress(item)}
                  style={[styles.notifCard, !item.read && styles.notifCardUnread]}
                >
                  <View style={[styles.iconBox, { backgroundColor: styleDef.bg }]}> 
                    <Ionicons name={styleDef.icon} size={20} color={styleDef.text} />
                  </View>
                  <View style={styles.notifContent}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitle, item.read && styles.notifTitleRead]}>
                        {item.title}
                      </Text>
                      {!item.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifMsg} numberOfLines={2}>
                      {item.message}
                    </Text>
                    <Text style={styles.notifTime}>{formatTimeLabel(item.timestamp)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {totalPages > 1 ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, !hasPrevious && styles.pageBtnDisabled]}
              onPress={() => loadNotifications(Math.max(0, currentPage - 2), true)}
              disabled={!hasPrevious}
            >
              <Text style={styles.pageBtnText}>Previous</Text>
            </TouchableOpacity>
            <Text style={styles.pageText}>Page {currentPage} of {totalPages}</Text>
            <TouchableOpacity
              style={[styles.pageBtn, !hasNext && styles.pageBtnDisabled]}
              onPress={() => loadNotifications(currentPage, true)}
              disabled={!hasNext}
            >
              <Text style={styles.pageBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Notification / Announcement Detail Modal ──────────────── */}
      {selectedNotif && (
        <Modal
          visible={!!selectedNotif}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedNotif(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedNotif(null)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <View style={[styles.iconBox, { backgroundColor: getTypeStyle(selectedNotif.type).bg }]}>
                  <Ionicons name={getTypeStyle(selectedNotif.type).icon} size={20} color={getTypeStyle(selectedNotif.type).text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{selectedNotif.title}</Text>
                  <Text style={styles.notifTime}>{formatTimeLabel(selectedNotif.timestamp)}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedNotif(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalMsg}>{selectedNotif.message}</Text>
              </ScrollView>
              <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setSelectedNotif(null)}>
                <Text style={styles.modalDoneBtnText}>Close</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 110 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  markReadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  markReadText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  markReadTextDisabled: { color: colors.textSecondary },

  errorText: { color: colors.error, fontSize: 12, marginBottom: 12 },
  list: { gap: 12 },

  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 10, fontSize: 14, fontWeight: '700', color: colors.text },
  emptyText: { marginTop: 6, fontSize: 12, color: colors.textSecondary },

  notifCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    flexDirection: 'row',
    gap: 12,
  },
  notifCardUnread: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notifTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text, flex: 1, paddingRight: 8 },
  notifTitleRead: { color: colors.textSecondary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 },
  notifMsg: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, lineHeight: 18 },
  notifTime: { fontSize: 10, color: colors.textSecondary, opacity: 0.7 },
  paginationRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pageBtn: {
    minWidth: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ─── Modal Styles ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 20,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    maxHeight: 280,
    marginBottom: 16,
  },
  modalMsg: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  modalDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default NotificationsScreen;
