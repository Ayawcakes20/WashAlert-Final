import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { notifications as notificationsApi } from '../../services/api';

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

  const loadNotifications = useCallback(async () => {
    try {
      setError('');
      const data = await notificationsApi.getAll();
      setItems(data.notifications || []);
    } catch (e) {
      setItems([]);
      setError(e?.message || 'Unable to load notifications right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch {
      // best effort for local read state
    }
  }, []);

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
          <Text style={styles.headerTitle}>Notifications</Text>
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
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>You are all caught up.</Text>
            </View>
          ) : (
            items.map((item) => {
              const styleDef = getTypeStyle(item.type);
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => markAsRead(item.id)}
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  markReadBtn: { flexDirection: 'row', alignItems: 'center' },
  markReadText: { fontSize: 12, fontWeight: '500', color: colors.primary, marginLeft: 4 },
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
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    gap: 12,
  },
  notifCardUnread: { borderColor: 'hsla(224, 82%, 48%, 0.3)' },
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
});

export default NotificationsScreen;
