import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, DEMO_MODE_ENABLED } from '../config/env';

const ORDER_STORAGE_KEY = 'washalert_orders_v1';
const USER_STORAGE_KEY = 'userData';
const NOTIFICATION_READ_IDS_KEY = 'washalert_notifications_read_ids_v1';
const SUPPORT_SESSION_KEY = 'washalert_support_session_id_v1';
const looksLikeHtml = (value) => /<!doctype html|<html[\s>]/i.test(String(value || ''));
const looksLikeNgrokWarningPage = (value) =>
  /ngrok/i.test(String(value || '')) &&
  /(visit site|tunnel|ERR_NGROK|ngrok-free\.dev)/i.test(String(value || ''));
const NGROK_SKIP_BROWSER_WARNING_HEADER = { 'ngrok-skip-browser-warning': 'true' };
const normalizePath = (path) => {
  const normalized = String(path || '').trim();
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};
const buildBackendUrl = (path) => {
  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  const normalizedPath = normalizePath(path);
  if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${base}${normalizedPath.slice(4)}`;
  }
  return `${base}${normalizedPath}`;
};
const toResponsePreview = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);

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
    address: '7605 Dela Rosa, Corner Wilson Street (inside R&R Carwash), Makati City, Metro Manila',
    phone: '(02) 1234-5678',
    hours: '7:00 AM - 10:00 PM',
    distance: 0.0,
    rating: 4.8,
    status: 'open',
    latitude: 14.5597,
    longitude: 121.0179,
  },
  {
    id: 2,
    name: 'Chestnut Branch',
    city: 'Quezon City',
    address: '244A Upper Republic Ave., West Fairview Park, Quezon City, Metro Manila',
    phone: '(02) 2345-6789',
    hours: '7:00 AM - 10:00 PM',
    distance: 2.5,
    rating: 4.7,
    status: 'open',
    latitude: 14.7046,
    longitude: 121.0675,
  },
  {
    id: 3,
    name: 'Republic Branch',
    city: 'Quezon City',
    address: 'Republic Avenue, West Fairview, Quezon City, Metro Manila',
    phone: '(02) 3456-7890',
    hours: '7:00 AM - 10:00 PM',
    distance: 3.1,
    rating: 4.9,
    status: 'open',
    latitude: 14.7007,
    longitude: 121.0633,
  },
  {
    id: 4,
    name: 'Holy Spirit Branch',
    city: 'Quezon City',
    address: 'Faustino Street, Brgy. Holy Spirit, Quezon City, Metro Manila',
    phone: '(02) 4567-8901',
    hours: '7:00 AM - 10:00 PM',
    distance: 4.0,
    rating: 4.6,
    status: 'open',
    latitude: 14.6946,
    longitude: 121.0841,
  },
  {
    id: 5,
    name: 'Sta. Catalina Branch',
    city: 'Quezon City',
    address: '408 Sta. Catalina St, Quezon City, Metro Manila',
    phone: '(02) 5678-9012',
    hours: '7:00 AM - 10:00 PM',
    distance: 2.8,
    rating: 4.5,
    status: 'open',
    latitude: 14.6341,
    longitude: 121.0448,
  },
  {
    id: 6,
    name: 'Brookside Branch',
    city: 'Cainta, Rizal',
    address: 'Sunset Drive, Brookside Hills Subdivision, Cainta, Rizal',
    phone: '(02) 6789-0123',
    hours: '7:00 AM - 10:00 PM',
    distance: 3.5,
    rating: 4.4,
    status: 'open',
    latitude: 14.5828,
    longitude: 121.1266,
  },
  {
    id: 7,
    name: 'JP Rizal Branch',
    city: 'Binangonan, Rizal',
    address: 'J.P. Rizal Ave, Binangonan, Rizal',
    phone: '(02) 7890-1234',
    hours: '7:00 AM - 10:00 PM',
    distance: 5.2,
    rating: 4.3,
    status: 'open',
    latitude: 14.4646,
    longitude: 121.1954,
  },
  {
    id: 8,
    name: 'Luzon Branch',
    city: 'Quezon City',
    address: 'Luzon Ave, Matandang Balara, Quezon City, Metro Manila',
    phone: '(02) 8901-2345',
    hours: '7:00 AM - 10:00 PM',
    distance: 6.0,
    rating: 4.2,
    status: 'open',
    latitude: 14.6703,
    longitude: 121.0863,
  },
  {
    id: 9,
    name: 'St. Anthony Branch',
    city: 'Quezon City',
    address: 'St. Anthony Street, Quezon City, Metro Manila',
    phone: '(02) 9012-3456',
    hours: '7:00 AM - 10:00 PM',
    distance: 4.5,
    rating: 4.6,
    status: 'open',
    latitude: 14.6481,
    longitude: 121.0536,
  },
  {
    id: 10,
    name: 'UP Diliman / San Vicente Branch',
    city: 'Quezon City',
    address: 'San Vicente, Diliman, Quezon City, Metro Manila',
    phone: '(02) 0123-4567',
    hours: '7:00 AM - 10:00 PM',
    distance: 7.1,
    rating: 4.1,
    status: 'open',
    latitude: 14.6518,
    longitude: 121.0646,
  },
];

const SERVICE_CATALOG = [
  {
    id: 'wash',
    name: 'Wash Only',
    price: 80,
    icon: 'water-outline',
    description: 'Basic washing service (up to 8kg)',
  },
  {
    id: 'dry',
    name: 'Dry Only',
    price: 90,
    icon: 'sunny-outline',
    description: 'Basic drying service (up to 8kg)',
  },
  {
    id: 'ecowash-full',
    name: 'Ecowash Full Service',
    price: 220,
    icon: 'leaf-outline',
    description: 'Eco-friendly full service (wash-dry-fold)',
  },
  {
    id: 'basic-full',
    name: 'Basic Full Service',
    price: 240,
    icon: 'shirt-outline',
    description: 'Standard full service (wash-dry-fold)',
  },
  {
    id: 'premium-full',
    name: 'Premium Full Service',
    price: 270,
    icon: 'sparkles-outline',
    description: 'Premium care full service (wash-dry-fold)',
  },
  {
    id: 'handwash',
    name: 'Handwash',
    price: 150,
    icon: 'hand-wash',
    description: 'Gentle handwashing service',
  },
];

const DETERGENT_OPTIONS = [
  { name: 'Surf detergent', price: 25 },
  { name: 'Ariel detergent', price: 30 },
  { name: 'None', price: 0 }
];
const CONDITIONER_OPTIONS = [
  { name: 'Charm fabcon', price: 15 },
  { name: 'Downy fabcon', price: 25 },
  { name: 'None', price: 0 }
];

const DEMO_DELIVERIES = [
  {
    id: '1',
    trackingNumber: 'WA-2024-001',
    customerName: 'John Doe',
    deliveryAddress: '123 Main St, Brgy. Commonwealth, QC',
    branch: 'Makati Branch',
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
        const preview = toResponsePreview(text);
        if (__DEV__) {
          console.warn('[API][NonJSON] HTML response detected', {
            status: res.status,
            contentType,
            preview,
          });
        }
        const err = new Error(
          looksLikeNgrokWarningPage(text)
            ? `Ngrok warning page received. Header may not be sent or URL is wrong. (${API_BASE_URL})`
            : `Backend returned HTML. Check ngrok warning/API base URL. (${API_BASE_URL})`
        );
        err.status = res.status;
        throw err;
      }
      payload = { message: text };
    }
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    
    if (payload && typeof payload === 'object') {
      message = payload.message || payload.error || payload.reason || message;
    } else if (text && !looksLikeHtml(text)) {
      message = text;
    }
    
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.ok && text) {
    const payloadLooksStructured = payload && typeof payload === 'object';
    if (!jsonContentType || parseFailed || !payloadLooksStructured) {
      const preview = toResponsePreview(text);
      if (__DEV__) {
        console.warn('[API][NonJSON] Unexpected non-JSON success response', {
          status: res.status,
          contentType,
          preview,
        });
      }
      const err = new Error(
        looksLikeNgrokWarningPage(text)
          ? `Ngrok warning page received. Header may not be sent or URL is wrong. (${API_BASE_URL})`
          : `Backend returned HTML. Check ngrok warning/API base URL. (${API_BASE_URL})`
      );
      err.status = res.status;
      throw err;
    }
  }

  return payload;
};

const apiRequest = async (path, options = {}) => {
  const { method = 'GET', body, headers = {} } = options;
  const url = buildBackendUrl(path);
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...NGROK_SKIP_BROWSER_WARNING_HEADER,
    ...headers,
  };
  if (__DEV__) {
    console.info('[API][Request]', {
      method,
      url,
      headerKeys: Object.keys(requestHeaders),
    });
  }
  return parseResponse(
    await fetch(url, {
      method,
      headers: requestHeaders,
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
    ORDER_RECEIVED: 'received',
    AWAITING_PRICE_CONFIRMATION: 'awaiting_price',
    PRICE_CONFIRMED: 'price_approved',
    WASHING: 'washing',
    DRYING: 'drying',
    READY: 'ready',
    OUT_FOR_DELIVERY: 'delivering',
    PENDING_PICKUP: 'delivering',
    EN_ROUTE_TO_PICKUP: 'delivering',
    PICKED_UP: 'delivering',
    IN_TRANSIT: 'delivering',
    DELIVERED: 'delivered',
    FAILED: 'cancelled',
    CANCELLED: 'cancelled',
    // ── Driver delivery phase statuses (must be preserved as-is for STATE_CONFIG matching) ──
    ASSIGNED_FOR_DELIVERY: 'ASSIGNED_FOR_DELIVERY',
    EN_ROUTE_TO_BRANCH: 'EN_ROUTE_TO_BRANCH',
    PICKED_UP_FROM_BRANCH: 'PICKED_UP_FROM_BRANCH',
    COLLECTION_FAILED: 'COLLECTION_FAILED',
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
  // Use numeric DB id for API calls (confirmPrice etc), fallback to tracking number
  id: jobOrder.id != null ? Number(jobOrder.id) : (previous.id ?? jobOrder.trackingNumber),
  dbId: jobOrder.id != null ? Number(jobOrder.id) : previous.dbId,
  trackingNumber: jobOrder.trackingNumber ?? previous.trackingNumber,
  branchId: previous.branchId ?? null,
  branchName: jobOrder.branch ?? previous.branchName ?? 'Unknown Branch',
  branchAddress: findBranchFromCatalog(jobOrder.branch || previous.branchName)?.address || '',
  serviceType:
    jobOrder.serviceType === 'PICKUP_DELIVERY'
      ? 'Pickup & Delivery'
      : jobOrder.serviceType === 'DROP_OFF'
        ? 'Drop Off'
        : previous.serviceType ?? 'Wash & Dry',
  serviceName: jobOrder.serviceName ?? previous.serviceName ?? null,
  serviceMode:
    previous.serviceMode ||
    parseServiceModeFromInstructions(jobOrder.specialInstructions) ||
    (jobOrder.serviceType === 'DROP_OFF' ? 'DROP_OFF_ONLY' : 'FULL_SERVICE'),
  loadKg: Number(jobOrder.estimatedWeightKg ?? previous.loadKg ?? 0),
  // Critical: preserve weight and price set by staff
  actualWeightKg: jobOrder.actualWeightKg != null ? Number(jobOrder.actualWeightKg) : (previous.actualWeightKg ?? null),
  finalPrice: jobOrder.finalPrice != null ? Number(jobOrder.finalPrice) : (previous.finalPrice ?? null),
  detergent: jobOrder.detergentPreference ?? previous.detergent ?? 'None',
  detergentQty: Number(jobOrder.detergentQuantity ?? previous.detergentQty ?? 0),
  conditioner: jobOrder.fabricConditionerPreference ?? previous.conditioner ?? 'None',
  conditionerQty: Number(jobOrder.conditionerQuantity ?? previous.conditionerQty ?? 0),
  status: toMobileOrderStatus(jobOrder.status ?? previous.status),
  amount: Number(jobOrder.totalPrice ?? previous.amount ?? 0),
  servicePrice: Number(jobOrder.servicePrice || previous.servicePrice || 0),
  suppliesPrice: Number(jobOrder.suppliesPrice || previous.suppliesPrice || 0),
  deliveryPrice: Number(jobOrder.deliveryPrice || previous.deliveryPrice || 0),
  rushPrice: Number(jobOrder.rushPrice || previous.rushPrice || 0),
  amountPaid: Number(previous.amountPaid ?? 0),
  paymentMethod: jobOrder.paymentMethod ?? previous.paymentMethod ?? 'GCash',
  paymentStatus: toMobilePaymentStatus(jobOrder, previous.paymentStatus ?? 'Pending'),
  date: parseDateLabel(jobOrder.createdAt ?? previous.dateBooked),
  dateBooked: jobOrder.createdAt ?? previous.dateBooked ?? new Date().toISOString(),
  estimatedTime: previous.estimatedTime ?? '2-4 hours',
  scheduleDate: jobOrder.bookingDate || previous.scheduleDate,
  scheduleTime: (jobOrder.slotStartTime && jobOrder.slotEndTime) 
    ? toSlotRangeLabel(jobOrder.slotStartTime, jobOrder.slotEndTime) 
    : (previous.scheduleTime || ''),
  staffName: jobOrder.createdByName || previous.staffName || '',
  customerName: jobOrder.customerName || previous.customerName || 'Customer',
  contactName: jobOrder.deliveryContactName || jobOrder.customerName || previous.contactName || 'Customer',
  customerPhone: jobOrder.customerPhone || previous.customerPhone || '',
  contactPhone: jobOrder.deliveryContactPhone || jobOrder.customerPhone || previous.contactPhone || '',
  deliveryAddress: jobOrder.deliveryAddress || previous.deliveryAddress || '',
  delivery:
    jobOrder.deliveryAddress || previous.delivery
      ? {
        address: jobOrder.deliveryAddress || previous.delivery?.address || '',
        unitFloor: jobOrder.deliveryUnitFloor || previous.delivery?.unitFloor || null,
        contactName: jobOrder.deliveryContactName || jobOrder.customerName || previous.delivery?.contactName || null,
        phone: jobOrder.deliveryContactPhone || jobOrder.customerPhone || previous.delivery?.phone || null,
        driver: jobOrder.assignedDriverName || previous.delivery?.driver || 'Assigned Driver',
        driverPhone: jobOrder.assignedDriverPhone || previous.delivery?.driverPhone || '',
        driverPhotoUrl: jobOrder.assignedDriverPhotoUrl || previous.delivery?.driverPhotoUrl || null,
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
        deliveryContactName: tracked.deliveryContactName,
        deliveryContactPhone: tracked.deliveryContactPhone,
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
          contactName: delivery.deliveryContactName || delivery.customerName || updated.delivery?.contactName || null,
          phone: delivery.deliveryContactPhone || delivery.customerPhone || updated.delivery?.phone || null,
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
      if (payment) {
        console.log('[Orders] Payment status tracking=', order.trackingNumber, 'status=', payment.status);
        updated.paymentMethod = payment.method || updated.paymentMethod;
        updated.paymentStatus = toMobilePaymentStatus(
          { paymentStatus: payment.status, isPaid: payment.status === 'PAID' || payment.status === 'VERIFIED' },
          updated.paymentStatus || 'Pending'
        );
        if (updated.paymentStatus === 'Paid') {
          updated.amountPaid = Number(payment.amount ?? updated.amountPaid ?? updated.amount ?? 0);
        }
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

  // Phase A: Inbound
  if (normalized === 'ASSIGNED_PICKUP') return 'accepted';
  if (normalized === 'ARRIVED_CUSTOMER') return 'at_customer';
  if (normalized === 'PICKED_UP') return 'picked_up';
  if (normalized === 'ARRIVED_BRANCH') return 'at_branch';
  if (normalized === 'HANDED_TO_BRANCH') return 'handed_over';

  // Phase B: Outbound
  if (normalized === 'ASSIGNED_DELIVERY') return 'ready_for_dispatch';
  if (normalized === 'OUT_FOR_DELIVERY') return 'en_route';
  if (normalized === 'ARRIVED_DELIVERY') return 'at_delivery';
  if (normalized === 'DELIVERED') return 'completed';

  // Legacy/Fallbacks
  if (normalized === 'PENDING_PICKUP') return 'pending';
  if (normalized === 'EN_ROUTE_TO_PICKUP') return 'en_route_pickup';
  if (normalized === 'IN_TRANSIT') return 'in_progress';
  if (normalized === 'FAILED') return 'failed';
  if (normalized === 'CANCELLED') return 'failed';

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

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isNonEmpty = (value) => String(value || '').trim().length > 0;
const findBranchFromCatalog = (branchName) =>
  BRANCH_CATALOG.find((branch) => String(branch?.name || '').trim().toLowerCase() === String(branchName || '').trim().toLowerCase()) || null;

const mapDelivery = (delivery) => {
  const catalogBranch = findBranchFromCatalog(delivery?.branch);
  const branchLatitude = toNullableNumber(delivery.branchLatitude) ?? toNullableNumber(catalogBranch?.latitude);
  const branchLongitude = toNullableNumber(delivery.branchLongitude) ?? toNullableNumber(catalogBranch?.longitude);
  const branchAddress = delivery.branchAddress || catalogBranch?.address || '';
  return ({
    id: isNonEmpty(delivery?.id) ? String(delivery.id) : null,
    orderId: toNullableNumber(delivery?.orderId),
    orderNumber: isNonEmpty(delivery?.trackingNumber) ? String(delivery.trackingNumber).trim() : null,
    trackingNumber: isNonEmpty(delivery?.trackingNumber) ? String(delivery.trackingNumber).trim() : null,
    customerName: delivery.customerName || 'Customer',
    contactName: delivery.deliveryContactName || delivery.customerName || 'Customer',
    customerPhone: delivery.customerPhone || '',
    contactPhone: delivery.deliveryContactPhone || delivery.customerPhone || '',
    deliveryAddress: delivery.deliveryAddress || '',
    deliveryUnitFloor: delivery.deliveryUnitFloor || null,
    deliveryContactName: delivery.deliveryContactName || null,
    deliveryContactPhone: delivery.deliveryContactPhone || null,
    branchId: toNullableNumber(delivery.branchId),
    branchName: delivery.branch || '',
    branchAddress,
    leg: delivery.leg || 'DELIVERY_TO_CUSTOMER',
    status: toMobileDeliveryStatus(delivery.status, delivery.workflowStatus),
    workflowStatus: delivery.workflowStatus || null,
    workflowLabel: toWorkflowLabel(delivery.workflowStatus),
    driverName: delivery.driverName || '',
    assignedDriverId: toNullableNumber(delivery.assignedDriverId),
    driverPhone: delivery.driverPhone || '',
    driverPhotoUrl: delivery.driverPhotoUrl || null,
    driverVehicle: delivery.driverVehicle || null,
    paymentMethod: delivery.paymentMethod || '',
    paymentStatus: delivery.paymentStatus || (delivery.isPaid ? 'PAID' : 'UNPAID'),
    isPaid: Boolean(delivery.isPaid),
    amountToCollect: Number(delivery.amountToCollect ?? delivery.totalPrice ?? 0),
    loadKg: toNullableNumber(delivery.loadKg),
    loadCount: toNullableNumber(delivery.loadCount),
    estimatedDelivery: delivery.estimatedArrivalAt || null,
    pickupProofUrl: delivery.pickupProofUrl || null,
    dropoffProofUrl: delivery.dropoffProofUrl || null,
    notes: delivery.notes || '',
    updatedAt: delivery.updatedAt || null,
    currentLatitude: toNullableNumber(delivery.currentLatitude),
    currentLongitude: toNullableNumber(delivery.currentLongitude),
    branchLatitude,
    branchLongitude,
    deliveryLatitude: toNullableNumber(delivery.deliveryLatitude),
    deliveryLongitude: toNullableNumber(delivery.deliveryLongitude),
    bagCount: toNullableNumber(delivery.bagCount),
    confirmationCode: delivery.confirmationCode || null,
    branchHandoverPhotoUrl: delivery.branchHandoverPhotoUrl || null,
    finalDeliveryPhotoUrl: delivery.finalDeliveryPhotoUrl || null,
  });
};

const isValidDeliveryForDetail = (delivery) =>
  Boolean(delivery && isNonEmpty(delivery.id) && isNonEmpty(delivery.orderNumber));

const suppressPhaseAIfPhaseBExists = (deliveries = []) => {
  const phaseBStatuses = new Set(['ready_for_dispatch', 'en_route', 'at_delivery', 'completed']);
  const trackingWithPhaseB = new Set(
    deliveries
      .filter((delivery) => phaseBStatuses.has(String(delivery?.status || '').toLowerCase()))
      .map((delivery) => String(delivery?.trackingNumber || '').trim())
      .filter(Boolean)
  );

  return deliveries.filter((delivery) => {
    const trackingNumber = String(delivery?.trackingNumber || '').trim();
    if (!trackingNumber) return true;
    if (!trackingWithPhaseB.has(trackingNumber)) return true;
    return String(delivery?.status || '').toLowerCase() !== 'handed_over';
  });
};
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
    branch: branch?.name || 'Makati Branch',
    branchId: Number(orderData.branchId || branch?.id || 0) || null,
    customerPhone: user?.phone || '09170000000',
    customerEmail: user?.email || '',
    serviceType: serviceTypeBackend,
    preferredDate: toIsoDate(orderData.scheduleDate),
    preferredSlotStartTime: toSlotStartTime(orderData.scheduleTime),
    detergentPreference: orderData.detergent || 'None',
    fabricConditionerPreference: orderData.conditioner || 'None',
    loadSize: orderData.loadSize || getLoadSize(Number(orderData.loadKg || 0)),
    estimatedWeightKg: Number(orderData.loadKg || (orderData.loadSize === 'LARGE' ? 8 : 5)),
    containsBulkyItems: Boolean(orderData.containsBulkyItems),
    specialInstructions: mergedInstructions,
    deliveryAddress: orderData.delivery ? orderData.deliveryAddress || 'To be provided' : null,
    serviceName: orderData.serviceName || 'Wash & Dry',
    isRush: !!orderData.isRush,
    distanceKm: Number(orderData.distanceKm || 0),
    paymentMethod: orderData.paymentMethod || 'GCash',
    deliveryLatitude: orderData.deliveryLatitude,
    deliveryLongitude: orderData.deliveryLongitude,
    deliveryUnitFloor: orderData.deliveryUnitFloor,
    deliveryContactName: orderData.deliveryContactName,
    deliveryContactPhone: orderData.deliveryContactPhone,
    branchLatitude: orderData.branchLatitude,
    branchLongitude: orderData.branchLongitude,
  };

  const created = await apiRequest('/api/bookings', { method: 'POST', body: payload });
  const mobileOrder = mapJobOrderToMobile(created, {
    branchId: orderData.branchId,
    serviceType: orderData.serviceType,
    amount: Number(orderData.total || 0),
    servicePrice: orderData.servicePrice || 0,
    suppliesPrice: orderData.suppliesPrice || 0,
    deliveryPrice: orderData.deliveryPrice || 0,
    rushPrice: orderData.rushPrice || 0,
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
  getById: async (id) => {
    try {
      // Always try the authenticated customer endpoint first — it returns actualWeightKg, finalPrice, etc.
      // This is the ONLY endpoint with all price data the receipt needs.
      if (!isNaN(id) && id != null) {
        const jobOrder = await apiRequest(`/api/orders/my/paged?size=100`);
        const match = (jobOrder?.content || []).find((o) => String(o.id) === String(id));
        if (match) {
          const mapped = mapJobOrderToMobile(match, {});
          // Save to local cache
          const orders = await getLocalOrders();
          const merged = orders.map((o) => (String(o.id) === String(mapped.id) ? mapped : o));
          if (!orders.find((o) => String(o.id) === String(mapped.id))) merged.push(mapped);
          await setLocalOrders(merged);
          return mapped;
        }
      }

      // Fallback: local cache
      const orders = await getLocalOrders();
      const found = orders.find((o) => String(o.id) === String(id) || String(o.trackingNumber) === String(id));
      if (found) {
        const refreshed = await refreshOrderStatus(found);
        const merged = orders.map((o) => (String(o.id) === String(refreshed.id) ? refreshed : o));
        await setLocalOrders(merged);
        return refreshed;
      }

      // Last resort: public track endpoint
      const tracked = await apiRequest(`/api/orders/track/${encodeURIComponent(id)}`);
      return mapJobOrderToMobile({
        id: tracked.id || tracked.trackingNumber,
        trackingNumber: tracked.trackingNumber,
        branch: tracked.branch,
        status: tracked.currentStatus,
        serviceType: tracked.serviceType,
      });
    } catch {
      // If all fails, return from local cache
      const orders = await getLocalOrders();
      return orders.find((o) => String(o.id) === String(id) || String(o.trackingNumber) === String(id)) || null;
    }
  },
  // Use numeric dbId to avoid 403 Forbidden — backend expects Long, not tracking string
  confirmPrice: async (order) => {
    const numericId = order?.dbId ?? order?.id;
    if (!numericId || isNaN(numericId)) throw new Error('Cannot confirm: invalid order ID.');
    return apiRequest(`/api/orders/${numericId}/confirm-price`, { method: 'PUT' });
  },
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
  getMyBookings: async (status = 'all', limit = 20, page = 0, search = '') => {
    try {
      const query = new URLSearchParams();
      query.set('status', status || 'all');
      query.set('page', String(Math.max(0, Number(page) || 0)));
      query.set('size', String(Math.max(1, Number(limit) || 20)));
      if (search && String(search).trim()) query.set('search', String(search).trim());
      const response = await apiRequest(`/api/orders/my/paged?${query.toString()}`);

      const localOrders = await getLocalOrders();
      const previousByTracking = new Map(
        localOrders
          .filter((order) => order?.trackingNumber)
          .map((order) => [String(order.trackingNumber), order])
      );

      const mapped = (response?.content || []).map((jobOrder) =>
        mapJobOrderToMobile(jobOrder, previousByTracking.get(String(jobOrder.trackingNumber)) || {})
      );

      return {
        bookings: mapped,
        total: Number(response?.totalElements || 0),
        page: Number(response?.page || 0),
        size: Number(response?.size || limit),
        totalPages: Number(response?.totalPages || 0),
        hasNext: Boolean(response?.hasNext),
        hasPrevious: Boolean(response?.hasPrevious),
      };
    } catch (_error) {
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
      if (search && String(search).trim()) {
        const needle = String(search).trim().toLowerCase();
        filtered = filtered.filter(
          (order) =>
            String(order.trackingNumber || '').toLowerCase().includes(needle) ||
            String(order.branchName || '').toLowerCase().includes(needle)
        );
      }
      const safePage = Math.max(0, Number(page) || 0);
      const safeSize = Math.max(1, Number(limit) || 20);
      const start = safePage * safeSize;
      const paged = filtered.slice(start, start + safeSize);
      return {
        bookings: paged,
        total: filtered.length,
        page: safePage,
        size: safeSize,
        totalPages: Math.ceil(filtered.length / safeSize),
        hasNext: start + safeSize < filtered.length,
        hasPrevious: safePage > 0,
      };
    }
  },

  // Lightweight pre-flight check: validates supply availability at the selected branch
  // without deducting stock. Returns { available: true } or throws with the backend message.
  checkSupplies: async (branch, detergent, detergentQuantity, conditioner, conditionerQuantity) => {
    return apiRequest('/api/bookings/check-supplies', {
      method: 'POST',
      body: { branch, detergent, detergentQuantity, conditioner, conditionerQuantity },
    });
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

  // confirmPrice is defined above in the bookings object (uses numeric dbId)
};

export const branches = {
  getAll: async () => ({ branches: BRANCH_CATALOG }),
  getById: async (id) => BRANCH_CATALOG.find((b) => Number(b.id) === Number(id)) || null,
  getAvailableSlots: async (branch, dateLike) => bookings.getAvailableSlots(branch, dateLike),
};

export const deliveries = {
  getMyPaged: async (status = 'all', page = 0, size = 10) => {
    try {
      const query = new URLSearchParams();
      query.set('status', status || 'all');
      query.set('page', String(Math.max(0, Number(page) || 0)));
      query.set('size', String(Math.max(1, Number(size) || 10)));
      const response = await apiRequest(`/api/deliveries/my/paged?${query.toString()}`);
      const mapped = suppressPhaseAIfPhaseBExists((response?.content || [])
        .map(mapDelivery)
        .filter(isValidDeliveryForDetail));
      return {
        deliveries: mapped,
        total: Number(response?.totalElements || 0),
        page: Number(response?.page || 0),
        size: Number(response?.size || size),
        totalPages: Number(response?.totalPages || 0),
        hasNext: Boolean(response?.hasNext),
        hasPrevious: Boolean(response?.hasPrevious),
      };
    } catch (error) {
      if (!DEMO_MODE_ENABLED) {
        rethrowAccessAware(
          error,
          'Delivery endpoints are restricted for this account role.'
        );
      }
      let mapped = DEMO_DELIVERIES.map(mapDelivery);
      mapped = mapped.filter(isValidDeliveryForDetail);
      mapped = suppressPhaseAIfPhaseBExists(mapped);
      if (status !== 'all') mapped = mapped.filter((d) => d.status === status);
      const safePage = Math.max(0, Number(page) || 0);
      const safeSize = Math.max(1, Number(size) || 10);
      const start = safePage * safeSize;
      return {
        deliveries: mapped.slice(start, start + safeSize),
        total: mapped.length,
        page: safePage,
        size: safeSize,
        totalPages: Math.ceil(mapped.length / safeSize),
        hasNext: start + safeSize < mapped.length,
        hasPrevious: safePage > 0,
      };
    }
  },

  /** Driver-facing: returns only deliveries assigned to the authenticated driver. */
  getMy: async (status = 'all') => {
    const paged = await deliveries.getMyPaged(status, 0, 50);
    return { deliveries: paged.deliveries };
  },

  /** Legacy alias kept so existing code doesn't break during transition */
  getAssigned: async (status = 'all') => deliveries.getMy(status),

  getAvailable: async () => {
    try {
      const rows = await apiRequest('/api/deliveries/available');
      const safeRows = Array.isArray(rows) ? rows : [];
      const validRows = safeRows.filter(
        (row) =>
          isNonEmpty(row?.trackingNumber) &&
          toNullableNumber(row?.orderId) !== null &&
          isNonEmpty(row?.customerName) &&
          isNonEmpty(row?.deliveryAddress)
      );
      return { orders: validRows };
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
    if (!isNonEmpty(trackingNumber)) {
      throw new Error('Cannot accept delivery without a tracking number.');
    }
    const payload = await apiRequest(`/api/deliveries/accept/${encodeURIComponent(trackingNumber)}`, {
      method: 'POST',
    });
    const mapped = mapDelivery(payload);
    if (!isValidDeliveryForDetail(mapped)) {
      throw new Error('Accepted delivery returned incomplete data. Please refresh.');
    }
    return mapped;
  },

  getById: async (id) => {
    if (!isNonEmpty(id)) {
      throw new Error('Delivery detail is unavailable because delivery ID is missing.');
    }
    try {
      const data = await apiRequest(`/api/deliveries/${id}`);
      const mapped = mapDelivery(data);
      if (!isValidDeliveryForDetail(mapped)) {
        throw new Error('Delivery detail returned incomplete data.');
      }
      return mapped;
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
    const payload = await apiRequest(`/api/deliveries/${id}/collect-cod`, {
      method: 'PATCH',
    });
    return mapDelivery(payload);
  },

  // â”€â”€ State Machine Actions â”€â”€

  arriveAtCustomer: async (id) => {
    const payload = await apiRequest(`/api/deliveries/${id}/arrive-customer`, { method: 'POST' });
    return mapDelivery(payload);
  },

  completePickup: async (id, { bagCount, pickupPhotoUrl }) => {
    const payload = await apiRequest(`/api/deliveries/${id}/pickup-complete`, {
      method: 'POST',
      body: { bagCount, pickupPhotoUrl },
    });
    return mapDelivery(payload);
  },

  arriveAtBranch: async (id) => {
    const payload = await apiRequest(`/api/deliveries/${id}/arrive-branch`, { method: 'POST' });
    return mapDelivery(payload);
  },

  branchHandover: async (id, { branchHandoverPhotoUrl }) => {
    const payload = await apiRequest(`/api/deliveries/${id}/branch-handover`, {
      method: 'POST',
      body: { branchHandoverPhotoUrl },
    });
    return mapDelivery(payload);
  },

  startDelivery: async (id) => {
    const payload = await apiRequest(`/api/deliveries/${id}/start-delivery`, { method: 'POST' });
    return mapDelivery(payload);
  },

  arriveForDelivery: async (id) => {
    const payload = await apiRequest(`/api/deliveries/${id}/arrive-delivery`, { method: 'POST' });
    return mapDelivery(payload);
  },

  resendConfirmationCode: async (id) => {
    const payload = await apiRequest(`/api/deliveries/${id}/resend-confirmation-code`, { method: 'POST' });
    return mapDelivery(payload);
  },

  finalHandover: async (id, { confirmationCode, finalDeliveryPhotoUrl }) => {
    const payload = await apiRequest(`/api/deliveries/${id}/final-handover`, {
      method: 'POST',
      body: { confirmationCode, finalDeliveryPhotoUrl },
    });
    return mapDelivery(payload);
  },
};

export const notifications = {
  getPaged: async (page = 0, size = 10) => {
    try {
      const query = new URLSearchParams();
      query.set('page', String(Math.max(0, Number(page) || 0)));
      query.set('size', String(Math.max(1, Number(size) || 10)));
      const response = await apiRequest(`/api/notifications/paged?${query.toString()}`);
      const list = Array.isArray(response?.content) ? response.content : [];
      const readIds = await getReadNotificationIds();
      return {
        notifications: list.map((item) => {
          const mapped = mapNotification(item);
          return { ...mapped, read: readIds.has(mapped.id) };
        }),
        total: Number(response?.totalElements || 0),
        page: Number(response?.page || 0),
        size: Number(response?.size || size),
        totalPages: Number(response?.totalPages || 0),
        hasNext: Boolean(response?.hasNext),
        hasPrevious: Boolean(response?.hasPrevious),
      };
    } catch (error) {
      if (!DEMO_MODE_ENABLED) {
        rethrowAccessAware(
          error,
          'Notifications endpoint is restricted for this account role in the current backend policy.'
        );
      }
      const readIds = await getReadNotificationIds();
      const safePage = Math.max(0, Number(page) || 0);
      const safeSize = Math.max(1, Number(size) || 10);
      const start = safePage * safeSize;
      const mappedDemo = DEMO_NOTIFICATIONS.map((item) => {
        const mapped = mapNotification(item);
        return { ...mapped, read: readIds.has(mapped.id) };
      });
      return {
        notifications: mappedDemo.slice(start, start + safeSize),
        total: mappedDemo.length,
        page: safePage,
        size: safeSize,
        totalPages: Math.ceil(mappedDemo.length / safeSize),
        hasNext: start + safeSize < mappedDemo.length,
        hasPrevious: safePage > 0,
      };
    }
  },

  getAll: async () => {
    const paged = await notifications.getPaged(0, 50);
    return { notifications: paged.notifications };
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
  initiateGcashCheckout: async (orderRef) => {
    const resolveTrackingNumber = async () => {
      const normalizeTracking = (value) => {
        const tracking = String(value || '').trim();
        return tracking ? tracking.toUpperCase() : '';
      };
      const maybeFetchTrackingById = async (idValue) => {
        const numericId = Number(idValue);
        if (!Number.isFinite(numericId) || numericId <= 0) return '';
        const order = await apiRequest(`/api/orders/${numericId}`);
        return normalizeTracking(order?.trackingNumber);
      };

      if (orderRef && typeof orderRef === 'object') {
        const directTracking =
          normalizeTracking(orderRef.trackingNumber) ||
          normalizeTracking(orderRef.orderTrackingNumber);
        if (directTracking) return directTracking;

        const fromDbId = await maybeFetchTrackingById(orderRef.dbId ?? orderRef.id ?? orderRef.orderId);
        if (fromDbId) return fromDbId;
      } else {
        const primitiveValue = String(orderRef || '').trim();
        if (/^WA-\d+$/i.test(primitiveValue)) return primitiveValue.toUpperCase();
        const fromNumeric = await maybeFetchTrackingById(primitiveValue);
        if (fromNumeric) return fromNumeric;
      }

      throw new Error('Unable to initiate payment: missing tracking number for this order.');
    };

    const trackingNumber = await resolveTrackingNumber();
    console.log('[Payments] Requesting GCash checkout URL for tracking=', trackingNumber);

    const payload = await apiRequest(`/api/payments/checkout/gcash/${encodeURIComponent(trackingNumber)}`, {
      method: 'POST',
    });
    
    console.log('[Payments] Raw checkout response=', payload);
    
    // Handle both snake_case and camelCase from backend
    const checkoutUrl = payload?.checkout_url || payload?.checkoutUrl || payload?.url;
    
    if (!checkoutUrl) {
      console.error('[Payments] No checkout URL in response:', payload);
      throw new Error('PayMongo did not return a valid checkout link. Response: ' + JSON.stringify(payload));
    }
    
    return { checkoutUrl, trackingNumber };
  },
  collectCodPayment: async (id) => {
    return deliveries.collectCodPayment(id);
  },
};

export const support = {
  chat: async (message, trackingNumber = null, selectedBranch = null, senderName = null) => {
    const sessionId = await getSupportSessionId();
    return await apiRequest('/api/support/chat', {
      method: 'POST',
      body: {
        message,
        trackingNumber,
        selectedBranch,
        senderName,
        sessionId,
      },
    });
  },
  getHistory: async () => {
    const sessionId = await getSupportSessionId();
    return await apiRequest(`/api/support/history?sessionId=${encodeURIComponent(sessionId)}`);
  },
};

export const driverOrders = {
  getTasks: async (page = 0, size = 20) => {
    const response = await apiRequest(`/api/orders/driver/tasks?page=${page}&size=${size}`);
    return {
      content: (response.content || []).map(order => mapJobOrderToMobile(order)),
      totalElements: response.totalElements,
      totalPages: response.totalPages,
    };
  },
  startPickupLeg: async (id) => await apiRequest(`/api/orders/${id}/driver/start-pickup-leg`, { method: 'PUT' }),
  confirmLaundryCollected: async (id) => await apiRequest(`/api/orders/${id}/driver/confirm-laundry-collected`, { method: 'PUT' }),
  confirmArrivedAtBranch: async (id) => await apiRequest(`/api/orders/${id}/driver/confirm-arrived-at-branch`, { method: 'PUT' }),
  startDeliveryLeg: async (id) => await apiRequest(`/api/orders/${id}/driver/start-delivery-leg`, { method: 'PUT' }),
  confirmDelivery: async (id, { codCollected }) => await apiRequest(`/api/orders/${id}/driver/confirm-delivery`, {
    method: 'PUT',
    body: { codCollected }
  }),
  getById: async (id) => {
    try {
      const order = await apiRequest(`/api/orders/driver/task/${id}`);
      return {
        ...mapJobOrderToMobile(order),
        status: String(order.status || '').toUpperCase(),
      };
    } catch (error) {
      throw new Error('Unable to load task. It may have already been completed or was not assigned to you.');
    }
  },
  updateLocation: async (id, { latitude, longitude }) => {
    return await apiRequest(`/api/orders/${id}/driver/location`, {
      method: 'PUT',
      body: { latitude, longitude }
    });
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
  BRANCH_CATALOG,
  fetchBranches,
  fetchOrders,
  createOrder,
  bookings,
  branches,
  deliveries,
  driverOrders,
  notifications,
  payments,
  support,
  profileApi,
};
