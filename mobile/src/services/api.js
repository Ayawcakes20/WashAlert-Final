import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, DEMO_MODE_ENABLED } from '../config/env';

const ORDER_STORAGE_KEY = 'washalert_orders_v1';
const USER_STORAGE_KEY = 'userData';
const NOTIFICATION_READ_IDS_KEY = 'washalert_notifications_read_ids_v1';
const SUPPORT_SESSION_KEY = 'washalert_support_session_id_v1';
const looksLikeHtml = (value) => /<!doctype html|<html[\s>]/i.test(String(value || ''));

const createSupportSessionId = () => `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getSupportSessionId = async () => {
  try {
    const existing = await AsyncStorage.getItem(SUPPORT_SESSION_KEY);
    if (existing) return existing;
    const next = createSupportSessionId();
    await AsyncStorage.setItem(SUPPORT_SESSION_KEY, next);
    return next;
  } catch {
    return createSupportSessionId();
  }
};

// Static booking catalog used by mobile until backend exposes catalog endpoints.
// IMPORTANT: branch 'name' must exactly match the branch names in the machines table
// and the branch names assigned to staff accounts in the web dashboard.
const BRANCH_CATALOG = [
  {
    id: 1,
    name: 'Makati Branch',
    city: 'Makati City',
    address: 'Makati Branch, Makati City',
    phone: '(02) 1234-5678',
    hours: '7:00 AM - 10:00 PM',
    distance: 0.0,
    rating: 4.8,
    status: 'open',
    latitude: 14.5574,
    longitude: 121.0084,
  },
  {
    id: 2,
    name: 'UP Diliman',
    city: 'Quezon City',
    address: 'UP Diliman, Quezon City',
    phone: '(02) 2345-6789',
    hours: '7:00 AM - 10:00 PM',
    distance: 2.5,
    rating: 4.7,
    status: 'open',
    latitude: 14.6538,
    longitude: 121.0685,
  },
  {
    id: 3,
    name: 'JP Rizal',
    city: 'Makati City',
    address: 'JP Rizal, Makati City',
    phone: '(02) 3456-7890',
    hours: '7:00 AM - 10:00 PM',
    distance: 3.1,
    rating: 4.9,
    status: 'open',
    latitude: 14.5714,
    longitude: 121.0188,
  },
  {
    id: 4,
    name: 'S. Catalina',
    city: 'Manila',
    address: 'S. Catalina, Manila',
    phone: '(02) 4567-8901',
    hours: '7:00 AM - 10:00 PM',
    distance: 4.0,
    rating: 4.6,
    status: 'open',
  },
  {
    id: 5,
    name: 'Pasig City',
    city: 'Pasig City',
    address: 'Pasig City',
    phone: '(02) 5678-9012',
    hours: '7:00 AM - 10:00 PM',
    distance: 2.8,
    rating: 4.5,
    status: 'open',
    latitude: 14.5683,
    longitude: 121.0714,
  },
  {
    id: 6,
    name: 'Republic Ave',
    city: 'Quezon City',
    address: 'Republic Ave, Quezon City',
    phone: '(02) 6789-0123',
    hours: '7:00 AM - 10:00 PM',
    distance: 3.5,
    rating: 4.4,
    status: 'open',
  },
  {
    id: 7,
    name: 'Chestnut St',
    city: 'Quezon City',
    address: 'Chestnut St, Quezon City',
    phone: '(02) 7890-1234',
    hours: '7:00 AM - 10:00 PM',
    distance: 5.2,
    rating: 4.3,
    status: 'open',
  },
  {
    id: 8,
    name: 'Tondo',
    city: 'Manila',
    address: 'Tondo, Manila',
    phone: '(02) 8901-2345',
    hours: '7:00 AM - 10:00 PM',
    distance: 6.0,
    rating: 4.2,
    status: 'open',
  },
  {
    id: 9,
    name: 'Samat St',
    city: 'Quezon City',
    address: 'Samat St, Quezon City',
    phone: '(02) 9012-3456',
    hours: '7:00 AM - 10:00 PM',
    distance: 4.5,
    rating: 4.6,
    status: 'open',
    latitude: 14.6291,
    longitude: 121.0963, 
  },
  {
    id: 10,
    name: 'St. Nino',
    city: 'Quezon City',
    address: 'St. Nino, Quezon City',
    phone: '(02) 0123-4567',
    hours: '7:00 AM - 10:00 PM',
    distance: 7.1,
    rating: 4.1,
    status: 'open',
  },
];

const SERVICE_CATALOG = [
  {
    id: 'wash',
    name: 'Wash (7kg)',
    price: 80,
    icon: 'water-outline',
    description: 'Basic washing service up to 7kg',
  },
  {
    id: 'dry',
    name: 'Dry (7kg)',
    price: 90,
    icon: 'sunny-outline',
    description: 'Basic drying service up to 7kg',
  },
  {
    id: 'ecowash-full',
    name: 'Ecowash Full Service (5kg)',
    price: 220,
    icon: 'leaf-outline',
    description: 'Eco-friendly full service (wash-dry-fold)',
  },
  {
    id: 'basic-full-7',
    name: 'Basic Full Service (7kg)',
    price: 240,
    icon: 'shirt-outline',
    description: 'Standard full service (7kg)',
  },
  {
    id: 'basic-full-8',
    name: 'Basic Full Service (8kg)',
    price: 245,
    icon: 'shirt-outline',
    description: 'Standard full service (8kg)',
  },
  {
    id: 'premium-full-7',
    name: 'Premium Full Service (7kg)',
    price: 270,
    icon: 'sparkles-outline',
    description: 'Premium full service with care (7kg)',
  },
  {
    id: 'premium-full-8',
    name: 'Premium Full Service (8kg)',
    price: 275,
    icon: 'sparkles-outline',
    description: 'Premium full service with care (8kg)',
  },
  {
    id: 'handwash',
    name: 'Handwash',
    price: 150,
    icon: 'hand-wash',
    description: 'Careful handwashing service (1-3kg: ₱150/kg, 3kg+: ₱90/kg)',
  },
];

const DETERGENT_OPTIONS = [
  { name: 'Surf (Basic)', price: 25 },
  { name: 'Ariel (Premium)', price: 30 },
  { name: 'None', price: 0 }
];
const CONDITIONER_OPTIONS = [
  { name: 'Charm (Basic)', price: 15 },
  { name: 'Downy (Premium)', price: 25 },
  { name: 'None', price: 0 }
];

const DEMO_DELIVERIES = [
  {
    id: '1',
    trackingNumber: 'WA-2024-001',
    customerName: 'John Doe',
    deliveryAddress: '123 Main St, Brgy. Commonwealth, QC',
    branch: 'Triplets Main',
    driverName: 'Mark Villanueva',
    driverPhone: '09171234567',
    status: 'PENDING_PICKUP',
    estimatedArrivalAt: null,
  },
  {
    id: '2',
    trackingNumber: 'WA-2024-002',
    customerName: 'Jane Smith',
    deliveryAddress: '456 Cubao Ave, QC',
    branch: 'Triplets Cubao',
    driverName: 'Leo Aquino',
    driverPhone: '09181234567',
    status: 'IN_TRANSIT',
    estimatedArrivalAt: null,
  },
];

const DEMO_NOTIFICATIONS = [
  {
    id: 'notif_001',
    severity: 'INFO',
    title: 'Laundry Update',
    message: 'Your laundry is now being washed.',
    createdAt: '2024-01-15T11:00:00Z',
  },
  {
    id: 'notif_002',
    severity: 'SUCCESS',
    title: 'Payment Confirmed',
    message: 'Payment via GCash has been confirmed.',
    createdAt: '2024-01-15T10:30:00Z',
  },
];

const parseResponse = async (res) => {
  const text = await res.text();
  const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
  const jsonContentType = contentType.includes('application/json') || contentType.includes('+json');
  let payload = null;
  let parseFailed = false;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      parseFailed = true;
      if (contentType.includes('text/html') || looksLikeHtml(text)) {
        const err = new Error(
          `Unexpected non-JSON response from API (${API_BASE_URL}). Check EXPO_PUBLIC_API_BASE_URL and backend port.`
        );
        err.status = res.status;
        throw err;
      }
      payload = { message: text };
    }
  }
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && (payload.message || payload.error)) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.ok && text) {
    const payloadLooksStructured = payload && typeof payload === 'object';
    if (!jsonContentType || parseFailed || !payloadLooksStructured) {
      const err = new Error(
        `Unexpected non-JSON response from API (${API_BASE_URL}). Check EXPO_PUBLIC_API_BASE_URL and backend port.`
      );
      err.status = res.status;
      throw err;
    }
  }

  return payload;
};

const apiRequest = async (path, options = {}) => {
  const { method = 'GET', body, headers = {} } = options;
  return parseResponse(
    await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })
  );
};

const getLocalOrders = async () => {
  try {
    const raw = await AsyncStorage.getItem(ORDER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setLocalOrders = async (orders) => {
  try {
    await AsyncStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // best effort
  }
};

const toMobileOrderStatus = (status) => {
  const map = {
    PENDING: 'pending',
    WASHING: 'washing',
    DRYING: 'drying',
    READY: 'ready',
    PENDING_PICKUP: 'delivering',
    EN_ROUTE_TO_PICKUP: 'delivering',
    PICKED_UP: 'delivering',
    IN_TRANSIT: 'delivering',
    DELIVERED: 'delivered',
    FAILED: 'cancelled',
  };
  return map[String(status || '').toUpperCase()] || String(status || '').toLowerCase();
};

const toMobilePaymentStatus = (order = {}, fallback = 'Pending') => {
  const backendPaymentStatus = String(order.paymentStatus || '').trim().toUpperCase();
  if (backendPaymentStatus === 'PAID' || backendPaymentStatus === 'VERIFIED') return 'Paid';
  if (backendPaymentStatus === 'REJECTED') return 'Rejected';
  if (backendPaymentStatus === 'PENDING') return 'Pending';
  if (order.isPaid) return 'Paid';
  return fallback;
};

const parseDateLabel = (isoDate) => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateForApi = (dateLike) => {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toSlotRangeLabel = (slotStartTime, slotEndTime) => {
  const makeDisplay = (value) => {
    const [rawH = '0', rawM = '0'] = String(value || '00:00:00').split(':');
    let hour = Number(rawH);
    const minute = Number(rawM);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    if (hour === 0) hour = 12;
    if (hour > 12) hour -= 12;
    return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
  };
  return `${makeDisplay(slotStartTime)} - ${makeDisplay(slotEndTime)}`;
};

const parseServiceModeFromInstructions = (notes = '') => {
  const source = String(notes || '').toLowerCase();
  if (source.includes('booking mode: drop-off only')) return 'DROP_OFF_ONLY';
  if (source.includes('booking mode: pick-up only')) return 'PICKUP_ONLY';
  if (source.includes('booking mode: full service')) return 'FULL_SERVICE';
  return null;
};

const mapJobOrderToMobile = (jobOrder, previous = {}) => ({
  id: String(jobOrder.id ?? jobOrder.trackingNumber ?? previous.id),
  trackingNumber: jobOrder.trackingNumber ?? previous.trackingNumber,
  branchId: previous.branchId ?? null,
  branchName: jobOrder.branch ?? previous.branchName ?? 'Unknown Branch',
  serviceType:
    jobOrder.serviceType === 'PICKUP_DELIVERY'
      ? 'Pickup & Delivery'
      : jobOrder.serviceType === 'DROP_OFF'
      ? 'Drop Off'
      : previous.serviceType ?? 'Wash & Dry',
  serviceMode:
    previous.serviceMode ||
    parseServiceModeFromInstructions(jobOrder.specialInstructions) ||
    (jobOrder.serviceType === 'DROP_OFF' ? 'DROP_OFF_ONLY' : 'FULL_SERVICE'),
  loadKg: Number(jobOrder.estimatedWeightKg ?? previous.loadKg ?? 0),
  detergent: jobOrder.detergentPreference ?? previous.detergent ?? 'None',
  conditioner: jobOrder.fabricConditionerPreference ?? previous.conditioner ?? 'None',
  status: toMobileOrderStatus(jobOrder.status ?? previous.status),
  amount: Number(jobOrder.totalPrice ?? previous.amount ?? 0),
  servicePrice: Number(jobOrder.servicePrice ?? 0),
  suppliesPrice: Number(jobOrder.suppliesPrice ?? 0),
  deliveryPrice: Number(jobOrder.deliveryPrice ?? 0),
  amountPaid: Number(previous.amountPaid ?? 0),
  paymentMethod: jobOrder.paymentMethod ?? previous.paymentMethod ?? 'GCash',
  paymentStatus: toMobilePaymentStatus(jobOrder, previous.paymentStatus ?? 'Pending'),
  date: parseDateLabel(jobOrder.createdAt ?? previous.dateBooked),
  dateBooked: jobOrder.createdAt ?? previous.dateBooked ?? new Date().toISOString(),
  estimatedTime: previous.estimatedTime ?? '2-4 hours',
  scheduleDate: previous.scheduleDate,
  scheduleTime: previous.scheduleTime,
  instructions: jobOrder.specialInstructions ?? previous.instructions ?? '',
  delivery:
    jobOrder.deliveryAddress || previous.delivery
      ? {
          address: jobOrder.deliveryAddress || previous.delivery?.address || '',
          driver: previous.delivery?.driver || 'Assigned Driver',
          driverPhone: previous.delivery?.driverPhone || '',
          driverPhotoUrl: previous.delivery?.driverPhotoUrl || null,
          driverVehicle: previous.delivery?.driverVehicle || null,
          eta: previous.delivery?.eta || null,
          pickupProofUrl: previous.delivery?.pickupProofUrl || null,
          dropoffProofUrl: previous.delivery?.dropoffProofUrl || null,
        }
      : null,
  timeline:
    previous.timeline ||
    [
      { step: 'Order Received', done: true, icon: 'cube-outline' },
      {
        step: 'Washing',
        done: toMobileOrderStatus(jobOrder.status) !== 'pending',
        icon: 'water-outline',
      },
      {
        step: 'Drying',
        done: ['drying', 'ready', 'delivering', 'delivered'].includes(
          toMobileOrderStatus(jobOrder.status)
        ),
        icon: 'bonfire-outline',
      },
      {
        step: 'Ready for Pickup',
        done: ['ready', 'delivering', 'delivered'].includes(toMobileOrderStatus(jobOrder.status)),
        icon: 'checkmark-circle-outline',
      },
      {
        step: 'Out for Delivery',
        done: ['delivering', 'delivered'].includes(toMobileOrderStatus(jobOrder.status)),
        icon: 'bus-outline',
      },
      {
        step: 'Delivered',
        done: toMobileOrderStatus(jobOrder.status) === 'delivered',
        icon: 'checkmark-done-outline',
      },
    ],
});

const refreshOrderStatus = async (order) => {
  if (!order?.trackingNumber) return order;
  try {
    console.log('[Orders] Refreshing order status tracking=', order.trackingNumber);
    const tracked = await apiRequest(`/api/orders/track/${encodeURIComponent(order.trackingNumber)}`);
    console.log('[Orders] Backend order status tracking=', order.trackingNumber, 'status=', tracked?.currentStatus);
    const updated = mapJobOrderToMobile(
      {
        id: order.id,
        trackingNumber: tracked.trackingNumber,
        branch: tracked.branch,
        status: tracked.currentStatus,
        createdAt: order.dateBooked,
        serviceType: tracked.serviceType,
        estimatedWeightKg: order.loadKg,
        detergentPreference: order.detergent,
        fabricConditionerPreference: order.conditioner,
        specialInstructions: order.instructions,
      },
      order
    );
    updated.timeline = (tracked.timeline || []).map((event) => ({
      step: String(event.status || '').replaceAll('_', ' '),
      time: event.changedAt ? new Date(event.changedAt).toLocaleString() : '',
      done: true,
      icon: 'checkmark-circle-outline',
    }));

    try {
      const delivery = await apiRequest(
        `/api/deliveries/track/${encodeURIComponent(order.trackingNumber)}`
      );
      if (delivery?.status) {
        console.log(
          '[Orders] Delivery status tracking=',
          order.trackingNumber,
          'status=',
          delivery.status,
          'workflow=',
          delivery.workflowStatus || '(none)'
        );
        updated.status = toMobileOrderStatusFromWorkflow(
          delivery.workflowStatus,
          toMobileOrderStatus(delivery.status)
        );
        updated.deliveryWorkflowStatus = delivery.workflowStatus || null;
        updated.delivery = {
          address: delivery.deliveryAddress || updated.delivery?.address || '',
          driver: delivery.driverName || 'Assigned Driver',
          driverPhone: delivery.driverPhone || '',
          driverPhotoUrl: delivery.driverPhotoUrl || null,
          driverVehicle: delivery.driverVehicle || null,
          eta: delivery.estimatedArrivalAt || null,
          pickupProofUrl: delivery.pickupProofUrl || null,
          dropoffProofUrl: delivery.dropoffProofUrl || null,
        };
        if (updated.status === 'delivering') updated.estimatedTime = 'On the way';
        if (updated.status === 'delivered') updated.estimatedTime = 'Completed';

        const deliveryTimeline = [];
        if (delivery.workflowStatus) {
          deliveryTimeline.push({
            step: toWorkflowLabel(delivery.workflowStatus),
            time: delivery.updatedAt ? new Date(delivery.updatedAt).toLocaleString() : '',
            done: true,
            icon: 'navigate-outline',
          });
        }
        if (delivery.pickupProofUrl) {
          deliveryTimeline.push({
            step: 'Pickup Proof Uploaded',
            time: delivery.updatedAt ? new Date(delivery.updatedAt).toLocaleString() : '',
            done: true,
            icon: 'camera-outline',
            photoUrl: delivery.pickupProofUrl,
          });
        }
        if (delivery.dropoffProofUrl) {
          deliveryTimeline.push({
            step: 'Drop-off Proof Uploaded',
            time: delivery.updatedAt ? new Date(delivery.updatedAt).toLocaleString() : '',
            done: true,
            icon: 'camera-outline',
            photoUrl: delivery.dropoffProofUrl,
          });
        }
        if (deliveryTimeline.length) {
          updated.timeline = [...updated.timeline, ...deliveryTimeline];
        }
      }
    } catch {
      // Delivery may not exist for non-delivery bookings.
    }

    try {
      const payment = await apiRequest(
        `/api/payments/track/${encodeURIComponent(order.trackingNumber)}`
      );
      console.log('[Orders] Payment status tracking=', order.trackingNumber, 'status=', payment?.status);
      updated.paymentMethod = payment?.method || updated.paymentMethod;
      updated.paymentStatus = toMobilePaymentStatus(
        { paymentStatus: payment?.status, isPaid: payment?.status === 'PAID' || payment?.status === 'VERIFIED' },
        updated.paymentStatus || 'Pending'
      );
      if (updated.paymentStatus === 'Paid') {
        updated.amountPaid = Number(payment?.amount ?? updated.amountPaid ?? updated.amount ?? 0);
      }
    } catch {
      // Payment record may not exist yet.
    }

    return updated;
  } catch {
    return order;
  }
};

const toIsoDate = (label) => {
  const date = label instanceof Date ? new Date(label.getTime()) : new Date();
  if (!(label instanceof Date)) {
    if (label === 'Tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (label === 'Other Day') {
      // Default to 2 days from now for 'Other Day'
      date.setDate(date.getDate() + 2);
    }
  }
  // Use local timezone instead of UTC to avoid date shift in UTC+8
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toSlotStartTime = (range) => {
  const first = String(range || '8:00 AM').split('-')[0].trim();
  const [time, period] = first.split(' ');
  let [h, m] = time.split(':').map((v) => Number(v));
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00`;
};

const getLoadSize = (kg) => {
  if (kg <= 3) return 'SMALL';
  if (kg <= 7) return 'MEDIUM';
  return 'LARGE';
};

const toWorkflowLabel = (workflowStatus) =>
  String(workflowStatus || '')
    .replaceAll('_', ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toMobileDeliveryStatus = (status, workflowStatus) => {
  const workflow = String(workflowStatus || '').toUpperCase();
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PENDING_PICKUP') return 'pending';
  if (normalized === 'EN_ROUTE_TO_PICKUP') return 'en_route';
  if (normalized === 'PICKED_UP') return 'picked_up';
  if (normalized === 'IN_TRANSIT') return 'in_progress';
  if (normalized === 'DELIVERED') return 'completed';
  if (normalized === 'FAILED') return 'failed';
  if (workflow === 'COMPLETED') return 'completed';
  if (workflow === 'CANCELLED') return 'failed';
  if (workflow === 'PICKED_UP') return 'picked_up';
  if (workflow === 'PICKING_UP') return 'en_route';
  if (['AT_SHOP', 'READY'].includes(workflow)) return 'in_progress';
  return 'pending';
};

const toMobileOrderStatusFromWorkflow = (workflowStatus, fallbackStatus) => {
  const workflow = String(workflowStatus || '').toUpperCase();
  if (workflow === 'COMPLETED') return 'delivered';
  if (workflow === 'CANCELLED') return 'cancelled';
  if (workflow) return 'delivering';
  return fallbackStatus;
};

const mapDelivery = (delivery) => ({
  id: String(delivery.id),
  orderNumber: delivery.trackingNumber,
  customerName: delivery.customerName || 'Customer',
  customerPhone: delivery.customerPhone || '',
  deliveryAddress: delivery.deliveryAddress || '',
  branchName: delivery.branch || '',
  leg: delivery.leg || 'DELIVERY_TO_CUSTOMER',
  status: toMobileDeliveryStatus(delivery.status, delivery.workflowStatus),
  workflowStatus: delivery.workflowStatus || null,
  workflowLabel: toWorkflowLabel(delivery.workflowStatus),
  driverName: delivery.driverName || '',
  driverPhone: delivery.driverPhone || '',
  driverPhotoUrl: delivery.driverPhotoUrl || null,
  driverVehicle: delivery.driverVehicle || null,
  paymentMethod: delivery.paymentMethod || '',
  isPaid: Boolean(delivery.isPaid),
  amountToCollect: Number(delivery.amountToCollect ?? delivery.totalPrice ?? 0),
  estimatedDelivery: delivery.estimatedArrivalAt || null,
  pickupProofUrl: delivery.pickupProofUrl || null,
  dropoffProofUrl: delivery.dropoffProofUrl || null,
  notes: delivery.notes || '',
  updatedAt: delivery.updatedAt || null,
  currentLatitude: delivery.currentLatitude,
  currentLongitude: delivery.currentLongitude,
  branchLatitude: delivery.branchLatitude,
  branchLongitude: delivery.branchLongitude,
  deliveryLatitude: delivery.deliveryLatitude,
  deliveryLongitude: delivery.deliveryLongitude,
});

const mapNotificationSeverity = (severity = '') => {
  const normalized = String(severity).toUpperCase();
  if (normalized === 'ERROR') return 'status';
  if (normalized === 'WARN' || normalized === 'WARNING') return 'delivery';
  if (normalized === 'SUCCESS') return 'payment';
  return 'status';
};

const mapNotificationType = (notification = {}) => {
  const title = String(notification.title || '').toLowerCase();
  const route = String(notification.route || '').toLowerCase();
  if (route.includes('announcement') || title.includes('announcement') || title.includes('closure') || title.includes('holiday')) {
    return 'promo';
  }
  return mapNotificationSeverity(notification.severity);
};

const mapNotification = (notification) => ({
  id: String(notification.id),
  type: mapNotificationType(notification),
  title: notification.title || 'Update',
  message: notification.message || '',
  timestamp: notification.createdAt || new Date().toISOString(),
  route: notification.route || null,
  read: false,
});

const getReadNotificationIds = async () => {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_READ_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((id) => String(id)) : []);
  } catch {
    return new Set();
  }
};

const saveReadNotificationIds = async (ids) => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_READ_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // best effort
  }
};

const rethrowAccessAware = (error, message403) => {
  if (error?.status === 403) {
    throw new Error(message403);
  }
  throw error;
};

export const fetchBranches = async () => BRANCH_CATALOG;

export const fetchOrders = async (status = 'all') => {
  const result = await bookings.getMyBookings(status, 100);
  return result.bookings;
};

export const createOrder = async (orderData) => {
  const userRaw = await AsyncStorage.getItem(USER_STORAGE_KEY);
  const user = userRaw ? JSON.parse(userRaw) : null;
  const branch = BRANCH_CATALOG.find((item) => item.id === orderData.branchId);

  const serviceTypeBackend =
    orderData.serviceTypeBackend || (orderData.delivery ? 'PICKUP_DELIVERY' : 'DROP_OFF');
  const serviceModeLabel = orderData.serviceModeLabel || 'Full Service';
  const normalizedInstruction = String(orderData.instructions || '').trim();
  const bookingModeNote = `Booking Mode: ${serviceModeLabel}`;
  const mergedInstructions = normalizedInstruction
    ? `${bookingModeNote}\n${normalizedInstruction}`
    : bookingModeNote;

  const payload = {
    customerName: user?.fullName || 'Mobile Customer',
    branch: branch?.name || 'Light Residences',
    customerPhone: user?.phone || '09170000000',
    customerEmail: user?.email || '',
    serviceType: serviceTypeBackend,
    preferredDate: toIsoDate(orderData.scheduleDate),
    preferredSlotStartTime: toSlotStartTime(orderData.scheduleTime),
    detergentPreference: orderData.detergent || 'None',
    fabricConditionerPreference: orderData.conditioner || 'None',
    loadSize: getLoadSize(Number(orderData.loadKg || 0)),
    estimatedWeightKg: Number(orderData.loadKg || 1),
    specialInstructions: mergedInstructions,
    deliveryAddress: orderData.delivery ? orderData.deliveryAddress || 'To be provided' : null,
    serviceName: orderData.serviceName || 'Wash & Dry',
    isRush: !!orderData.isRush,
    distanceKm: Number(orderData.distanceKm || 0),
    paymentMethod: orderData.paymentMethod || 'GCash',
    deliveryLatitude: orderData.deliveryLatitude,
    deliveryLongitude: orderData.deliveryLongitude,
    branchLatitude: orderData.branchLatitude,
    branchLongitude: orderData.branchLongitude,
  };

  const created = await apiRequest('/api/bookings', { method: 'POST', body: payload });
  const mobileOrder = mapJobOrderToMobile(created, {
    branchId: orderData.branchId,
    serviceType: orderData.serviceType,
    amount: Number(orderData.total || 0),
    amountPaid: 0,
    paymentMethod: orderData.paymentMethod === 'cash' ? 'Cash' : 'GCash',
    paymentStatus: 'Pending',
    estimatedTime: '2-4 hours',
    scheduleDate: orderData.scheduleDate,
    scheduleTime: orderData.scheduleTime,
    instructions: mergedInstructions,
    serviceMode: orderData.serviceMode || 'FULL_SERVICE',
    delivery: orderData.delivery
      ? { address: orderData.deliveryAddress || 'To be provided', driver: 'Assigned Driver' }
      : null,
  });

  const existing = await getLocalOrders();
  await setLocalOrders([mobileOrder, ...existing]);
  return mobileOrder;
};

export const estimatePrice = async (data) => {
  return await apiRequest('/api/bookings/estimate', { method: 'POST', body: data });
};

export const laundry = {
  getServices: async () => ({ services: SERVICE_CATALOG }),
  getPreferences: async () => ({
    detergents: DETERGENT_OPTIONS.map(d => d.name),
    conditioners: CONDITIONER_OPTIONS.map(c => c.name)
  }),
};

export const bookings = {
  cancel: async (id) => await apiRequest(`/api/bookings/${id}/cancel`, { method: 'PATCH' }),
  getAvailableSlots: async (branch, dateLike) => {
    const date = formatDateForApi(dateLike);
    const path = `/api/bookings/slots?branch=${encodeURIComponent(branch)}&date=${encodeURIComponent(date)}`;
    const slots = await apiRequest(path);
    return (slots || []).map((slot) => ({
      slotStartTime: slot.slotStartTime,
      slotEndTime: slot.slotEndTime,
      label: toSlotRangeLabel(slot.slotStartTime, slot.slotEndTime),
      available: Boolean(slot.available),
      slotsRemaining: Number(slot.slotsRemaining || 0),
    }));
  },
  getMyBookings: async (status = 'all', limit = 20) => {
    const stored = await getLocalOrders();
    const refreshed = await Promise.all(stored.map(refreshOrderStatus));
    await setLocalOrders(refreshed);

    let filtered = [...refreshed];
    if (status !== 'all') {
      const statusMap = {
        active: ['pending', 'received', 'washing', 'drying', 'ready', 'delivering'],
        completed: ['delivered', 'completed'],
        cancelled: ['cancelled'],
      };
      filtered = filtered.filter((o) => statusMap[status]?.includes(o.status));
    }

    return { bookings: filtered.slice(0, limit), total: filtered.length };
  },

  getById: async (id) => {
    const orders = await getLocalOrders();
    const found = orders.find((o) => String(o.id) === String(id) || o.trackingNumber === id);
    if (!found) {
      try {
        const tracked = await apiRequest(`/api/orders/track/${encodeURIComponent(id)}`);
        return mapJobOrderToMobile({
          id: tracked.trackingNumber,
          trackingNumber: tracked.trackingNumber,
          branch: tracked.branch,
          status: tracked.currentStatus,
          serviceType: tracked.serviceType,
        });
      } catch {
        return null;
      }
    }

    const refreshed = await refreshOrderStatus(found);
    const merged = orders.map((o) => (String(o.id) === String(refreshed.id) ? refreshed : o));
    await setLocalOrders(merged);
    return refreshed;
  },

  getTimeline: async (trackingNumber) => {
    if (!trackingNumber) return { timeline: [] };
    const tracked = await apiRequest(`/api/orders/track/${encodeURIComponent(trackingNumber)}`);
    return {
      timeline: (tracked.timeline || []).map((event) => ({
        status: toMobileOrderStatus(event.status),
        timestamp: event.changedAt,
        description: event.notes || String(event.status || '').replaceAll('_', ' '),
      })),
    };
  },
};

export const branches = {
  getAll: async () => ({ branches: BRANCH_CATALOG }),
  getById: async (id) => BRANCH_CATALOG.find((b) => Number(b.id) === Number(id)) || null,
  getAvailableSlots: async (branch, dateLike) => bookings.getAvailableSlots(branch, dateLike),
};

export const deliveries = {
  /** Driver-facing: returns only deliveries assigned to the authenticated driver. */
  getMy: async (status = 'all') => {
    try {
      const all = await apiRequest('/api/deliveries/my');
      let mapped = (all || []).map(mapDelivery);
      if (status !== 'all') {
        mapped = mapped.filter((d) => d.status === status);
      }
      return { deliveries: mapped };
    } catch (error) {
      if (!DEMO_MODE_ENABLED) {
        rethrowAccessAware(
          error,
          'Delivery endpoints are restricted for this account role.'
        );
      }
      let mapped = DEMO_DELIVERIES.map(mapDelivery);
      if (status !== 'all') {
        mapped = mapped.filter((d) => d.status === status);
      }
      return { deliveries: mapped };
    }
  },

  /** Legacy alias kept so existing code doesn't break during transition */
  getAssigned: async (status = 'all') => deliveries.getMy(status),

  getAvailable: async () => {
    try {
      const rows = await apiRequest('/api/deliveries/available');
      return { orders: rows || [] };
    } catch (error) {
      if (!DEMO_MODE_ENABLED) {
        rethrowAccessAware(
          error,
          'Available delivery bookings are restricted for this account role.'
        );
      }
      return { orders: [] };
    }
  },

  acceptBooking: async (trackingNumber) => {
    const payload = await apiRequest(`/api/deliveries/accept/${encodeURIComponent(trackingNumber)}`, {
      method: 'POST',
    });
    return mapDelivery(payload);
  },

  getById: async (id) => {
    try {
      const data = await apiRequest(`/api/deliveries/${id}`);
      return mapDelivery(data);
    } catch (error) {
      if (!DEMO_MODE_ENABLED) {
        rethrowAccessAware(
          error,
          'Delivery endpoints are restricted for this account role in the current backend policy.'
        );
      }
      const fallback = DEMO_DELIVERIES.find((d) => String(d.id) === String(id));
      return fallback ? mapDelivery(fallback) : null;
    }
  },

  updateStatus: async (id, status) => {
    const statusMap = {
      pending: 'PENDING_PICKUP',
      en_route: 'EN_ROUTE_TO_PICKUP',
      picked_up: 'PICKED_UP',
      in_progress: 'IN_TRANSIT',
      completed: 'DELIVERED',
      failed: 'FAILED',
    };
    try {
      await apiRequest(`/api/deliveries/${id}/status`, {
        method: 'PUT',
        body: { status: statusMap[status] || 'IN_TRANSIT', notes: null },
      });
      return { success: true };
    } catch (error) {
      if (!DEMO_MODE_ENABLED) {
        rethrowAccessAware(
          error,
          'Delivery endpoints are restricted for this account role in the current backend policy.'
        );
      }
      return { success: true };
    }
  },
  updateLocation: async (id, { latitude, longitude, estimatedArrivalAt = null, notes = null }) => {
    await apiRequest(`/api/deliveries/${id}/location`, {
      method: 'PUT',
      body: {
        latitude,
        longitude,
        estimatedArrivalAt,
        notes,
      },
    });
    return { success: true };
  },
  uploadProof: async (id, proofType, proofUrl) => {
    const payload = await apiRequest(`/api/deliveries/${id}/proof`, {
      method: 'PUT',
      body: {
        proofType,
        proofUrl,
      },
    });
    return mapDelivery(payload);
  },
  collectCodPayment: async (id) => {
    await apiRequest(`/api/deliveries/${id}/collect-cod`, {
      method: 'PATCH',
    });
    return { success: true };
  },
};

export const notifications = {
  getAll: async () => {
    try {
      const response = await apiRequest('/api/notifications');
      const list = Array.isArray(response) ? response : [];
      const readIds = await getReadNotificationIds();
      return {
        notifications: list.map((item) => {
          const mapped = mapNotification(item);
          return { ...mapped, read: readIds.has(mapped.id) };
        }),
      };
    } catch (error) {
      if (!DEMO_MODE_ENABLED) {
        rethrowAccessAware(
          error,
          'Notifications endpoint is restricted for this account role in the current backend policy.'
        );
      }
      const readIds = await getReadNotificationIds();
      return {
        notifications: DEMO_NOTIFICATIONS.map((item) => {
          const mapped = mapNotification(item);
          return { ...mapped, read: readIds.has(mapped.id) };
        }),
      };
    }
  },

  markAsRead: async (id) => {
    const readIds = await getReadNotificationIds();
    readIds.add(String(id));
    await saveReadNotificationIds(readIds);
    return { success: true };
  },

  markAllAsRead: async (ids = []) => {
    const readIds = await getReadNotificationIds();
    ids.forEach((id) => readIds.add(String(id)));
    await saveReadNotificationIds(readIds);
    return { success: true };
  },
};

export const payments = {
  initiateGcashCheckout: async (trackingNumber) => {
    console.log('[Payments] Requesting GCash checkout URL tracking=', trackingNumber);
    const payload = await apiRequest(`/api/payments/checkout/gcash/${encodeURIComponent(trackingNumber)}`, {
      method: 'POST',
    });
    console.log('[Payments] Raw checkout response=', payload);
    const checkoutUrl = payload?.checkout_url || payload?.checkoutUrl || payload?.url || null;
    console.log('[Payments] Checkout URL=', checkoutUrl || '(missing)');
    return checkoutUrl;
  },
  collectCodPayment: async (id) => {
    return deliveries.collectCodPayment(id);
  },
};

export const support = {
  chat: async (message, trackingNumber = null) => {
<<<<<<< HEAD
    const sessionId = await getSupportSessionId();
    return await apiRequest('/api/support/chat', {
      method: 'POST',
      body: {
        message,
        trackingNumber,
        sessionId,
      },
    });
=======
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("Missing EXPO_PUBLIC_GEMINI_API_KEY in .env");
        return { reply: "Mabuhay! Ang aming AI chatbot ay kasalukuyang hindi available dahil walang nakalagay na API key." };
      }

      let orderContext = "";
      if (trackingNumber) {
        try {
          const order = await bookings.getById(trackingNumber);
          if (order) {
             orderContext = `IMPORMASYON TUNGKOL SA ORDER '${trackingNumber}': Nakita sa system na ang status ng laundry nila ay '${order.status}'. I-update at ipaliwanag nang malinaw sa customer kung ano ang ibig sabihin ng status na ito.`;
          } else {
             orderContext = `Sinubukan kong hanapin ang tracking number '${trackingNumber}' sa system natin, pero HINDI ITO NAKITA. Sabihin sa customer na baka mali ang na-type niya o paki-check ulit ang resibo.`;
          }
        } catch (e) {
          orderContext = `Sinubukang hanapin ang tracking number '${trackingNumber}' pero may mali sa system. Humingi ng paumanhin sa customer at paki-try ulit maya-maya.`;
        }
      }

      const servicesText = SERVICE_CATALOG.map(s => `- ${s.name}: ₱${s.price}`).join('\n');
      const branchesText = BRANCH_CATALOG.map(b => `- ${b.name}`).join('\n');

      const prompt = `Isa kang customer service chatbot na nagngangalang 'IkotAsk' para sa WashAlert mobile app. Ang WashAlert ay isang makabagong laundry service app sa Pilipinas. 
Laging sumagot sa wikang Tagalog, maging sobrang magalang, matulungin, at malinaw.
Huwag kang mag-imbento ng impormasyon, gamitin lamang ang mga presyong ibinigay dito.

MGA PRESYO AT SERBISYO NAMIN:
${servicesText}

MGA BRANCHES NAMIN:
${branchesText}

${orderContext}

Tanong ng customer: ${message}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!res.ok) {
        console.error("[IkotAsk] Gemini API error:", await res.text());
        return { reply: 'Medyo abala ako ngayon o mahina ang aking signal. Pwede mo bang subukan ulit mamaya?' };
      }

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!reply) {
         return { reply: 'Pasensya na, wala akong mahagilap na sagot para diyan.' };
      }
      
      return { reply };
    } catch (e) {
      console.error("[IkotAsk] Exception:", e);
      return { reply: 'Nagkaproblema sa koneksyon patungo sa aking utak. Paki-try ulit mamaya.' };
    }
>>>>>>> 13002db20003c175d5e263fc45ec83e946f8cbc3
  },
};

export const profileApi = {
  updateProfile: async ({ fullName, mobileNumber, profileImageUrl }) =>
    await apiRequest('/api/user/profile', {
      method: 'PUT',
      body: {
        fullName,
        mobileNumber,
        profileImageUrl,
      },
    }),
  updateFcmToken: async ({ fcmToken, platform, deviceId }) =>
    await apiRequest('/api/user/profile/fcm-token', {
      method: 'PUT',
      body: {
        fcmToken,
        platform,
        deviceId,
      },
    }),
};

export default {
  fetchBranches,
  fetchOrders,
  createOrder,
  bookings,
  branches,
  deliveries,
  notifications,
  payments,
  support,
  profileApi,
};
