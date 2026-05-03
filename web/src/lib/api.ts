const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export type MeResponse = {
  id: number;
  firebaseUid?: string | null;
  email: string;
  fullName: string;
  role: string;
  status?: string;
  branchId?: number | null;
  branch: string;
  enabled: boolean;
  mustChangePassword: boolean;
  provider: string;
};

export type AuthSessionProfile = {
  id: number;
  firebaseUid: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  mustChangePassword?: boolean;
  branchId: number | null;
  branch: string;
  allowedModules: string[];
  platform: string;
};

export type FirebaseLoginOtpChallenge = {
  email: string;
  message: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  requiresPasswordUpdate?: boolean;
};

export type JobOrderResponse = {
  id: number;
  trackingNumber: string;
  customerName: string;
  branch: string;
  status: "PENDING" | "ORDER_RECEIVED" | "AWAITING_PRICE_CONFIRMATION" | "PRICE_CONFIRMED" | "WASHING" | "DRYING" | "READY" | "ASSIGNED_FOR_DELIVERY" | "EN_ROUTE_TO_BRANCH" | "PICKED_UP_FROM_BRANCH" | "OUT_FOR_DELIVERY" | "DELIVERED" | "COLLECTION_FAILED" | "CANCELLED" | "FAILED";
  createdAt: string;
  updatedAt: string;
  serviceType: "DROP_OFF" | "PICKUP_DELIVERY";
  bookingDate: string;
  slotStartTime: string;
  slotEndTime: string;
  detergentPreference: string;
  fabricConditionerPreference: string;
  serviceName: string;
  loadSize: "SMALL" | "MEDIUM" | "LARGE";
  estimatedWeightKg: number;
  specialInstructions: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string | null;
  servicePrice?: number | null;
  suppliesPrice?: number | null;
  deliveryPrice?: number | null;
  rushPrice?: number | null;
  totalPrice?: number | null;
  isPaid?: boolean;
  paymentMethod?: string | null;
  paymentStatus?: "PENDING" | "VERIFIED" | "REJECTED" | "PAID" | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  branchLatitude?: number | null;
  branchLongitude?: number | null;
  actualWeightKg?: number | null;
  confirmedPrice?: number | null;
  priceConfirmationDeadline?: string | null;
  priceConfirmedAt?: string | null;
  priceConfirmedByCustomer?: boolean;
  assignedDriverId?: number | null;
  assignedDriverName?: string | null;
  assignedAt?: string | null;
  pickupConfirmedAt?: string | null;
  deliveredAt?: string | null;
  codCollected?: boolean;
  codCollectedAt?: string | null;
  deliveryFailedReason?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
};

export type CreateOrderPayload = {
  customerName: string;
  serviceType: "DROP_OFF" | "PICKUP_DELIVERY";
  branch: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  paymentMethod?: string;
};

export type UpdateOrderPayload = {
  customerName: string;
  serviceType: "DROP_OFF" | "PICKUP_DELIVERY";
  branch: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  paymentMethod?: string;
};

export type UserAdminRecord = {
  id: number;
  email: string;
  fullName: string;
  role: "ADMIN" | "STAFF" | "DRIVER" | "CUSTOMER";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  branch: string;
  branchId: number | null;
  invitedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  mustChangePassword: boolean;
};

export type DeliveryRecord = {
  id: number;
  trackingNumber: string;
  branch: string;
  customerName: string;
  deliveryAddress: string;
  driverName: string;
  driverPhone: string;
  status: string;
  currentLatitude: number | null;
  currentLongitude: number | null;
  estimatedArrivalAt: string | null;
  notes: string | null;
  updatedAt: string;
};

export type InventoryRecord = {
  id: number;
  branch: string;
  itemName: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  lowStock: boolean;
  updatedAt: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  route: string;
  severity: "warning" | "success" | "info";
  createdAt: string;
};

export type PagedResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type AnnouncementType = "CLOSURE" | "HOLIDAY" | "GENERAL";

export type AnnouncementRecord = {
  id: number;
  title: string;
  message: string;
  type: AnnouncementType;
  targetAllBranches: boolean;
  branch: string | null;
  createdByUserId: number | null;
  createdByName: string | null;
  createdAt: string;
};

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `Request failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return data as T;
};

export const apiRequest = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const { method = "GET", body, headers } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse<T>(response);
};

export const authApi = {
  login: (payload: { email: string; password: string; rememberMe?: boolean }) =>
    apiRequest<MeResponse>("/api/auth/login", { method: "POST", body: payload }),
  requestFirebaseLoginOtp: (payload: { idToken: string; platform: "WEB" | "MOBILE"; selectedBranch?: string }) =>
    apiRequest<FirebaseLoginOtpChallenge>("/api/auth/firebase-login-otp/request", {
      method: "POST",
      body: payload,
    }),
  resendFirebaseLoginOtp: (payload: { idToken: string; platform: "WEB" | "MOBILE"; selectedBranch?: string }) =>
    apiRequest<FirebaseLoginOtpChallenge>("/api/auth/firebase-login-otp/resend", {
      method: "POST",
      body: payload,
    }),
  verifyFirebaseLoginOtp: (payload: {
    idToken: string;
    platform: "WEB" | "MOBILE";
    code: string;
    selectedBranch?: string;
  }) => apiRequest<AuthSessionProfile>("/api/auth/firebase-login-otp/verify", {
    method: "POST",
    body: payload,
  }),
  completeInvitation: (payload: { idToken: string }) =>
    apiRequest<void>("/api/auth/complete-invitation", { method: "POST", body: payload }),
  register: (payload: { fullName: string; email: string; password: string }) =>
    apiRequest<void>("/api/auth/register", { method: "POST", body: payload }),
  verifyEmailOtp: (payload: { email: string; code: string }) =>
    apiRequest<void>("/api/auth/otp/verify", { method: "POST", body: payload }),
  resendOtp: (payload: { email: string }) =>
    apiRequest<void>("/api/auth/otp/request", { method: "POST", body: payload }),
  forgotPassword: (payload: { email: string }) =>
    apiRequest<void>("/api/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload: { token: string; newPassword: string }) =>
    apiRequest<void>("/api/auth/reset-password", { method: "POST", body: payload }),
  setPassword: (payload: { token: string; newPassword: string }) =>
    apiRequest<void>("/api/auth/set-password", { method: "POST", body: payload }),
  me: () => apiRequest<MeResponse>("/api/auth/me"),
  updateProfile: (payload: { fullName: string }) =>
    apiRequest<void>("/api/user/profile", { method: "PUT", body: payload }),
  logout: () => apiRequest<void>("/api/auth/logout", { method: "POST" }),
};

export const dashboardApi = {
  summary: () =>
    apiRequest<{
      orders: { pending: number; washing: number; drying: number; ready: number };
      machines: { available: number; inUse: number; maintenance: number };
      recentOrders: JobOrderResponse[];
    }>("/api/dashboard/summary"),
};

export const ordersApi = {
  list: () => apiRequest<JobOrderResponse[]>("/api/orders"),
  listPaged: (params?: {
    page?: number;
    size?: number;
    sort?: string;
    direction?: "asc" | "desc";
    branch?: string;
    status?: string;
    search?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page != null) query.set("page", String(params.page));
    if (params?.size != null) query.set("size", String(params.size));
    if (params?.sort) query.set("sort", `${params.sort},${params.direction || "desc"}`);
    if (params?.branch) query.set("branch", params.branch);
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    if (params?.paymentStatus) query.set("paymentStatus", params.paymentStatus);
    if (params?.paymentMethod) query.set("paymentMethod", params.paymentMethod);
    if (params?.fromDate) query.set("fromDate", params.fromDate);
    if (params?.toDate) query.set("toDate", params.toDate);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<PagedResponse<JobOrderResponse>>(`/api/orders/paged${suffix}`);
  },
  getById: (id: number) => apiRequest<JobOrderResponse>(`/api/orders/${id}`),
  create: (payload: CreateOrderPayload) =>
    apiRequest<JobOrderResponse>("/api/orders", {
      method: "POST",
      body: payload,
    }),
  update: (id: number, payload: UpdateOrderPayload) =>
    apiRequest<JobOrderResponse>(`/api/orders/${id}`, {
      method: "PUT",
      body: payload,
    }),
  remove: (id: number) =>
    apiRequest<void>(`/api/orders/${id}`, {
      method: "DELETE",
    }),
  updateStatus: (id: number, status: "PENDING" | "WASHING" | "DRYING" | "READY" | "PICKED_UP" | "DELIVERED") =>
    apiRequest<JobOrderResponse>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: { status },
    }),
  markAsPaid: (id: number) =>
    apiRequest<JobOrderResponse>(`/api/orders/${id}/pay`, {
      method: "PATCH",
    }),
  cancel: (id: number) =>
    apiRequest<JobOrderResponse>(`/api/bookings/${id}/cancel`, {
      method: "PATCH",
    }),
  setActualWeight: (id: number, payload: { actualWeightKg: number; finalPrice: number }) =>
    apiRequest<JobOrderResponse>(`/api/orders/${id}/set-actual-weight`, {
      method: "PUT",
      body: payload,
    }),
  setPrice: (id: number, payload: { actualWeightKg: number; finalPrice: number }) =>
    apiRequest<JobOrderResponse>(`/api/orders/${id}/set-price`, {
      method: "POST",
      body: payload,
    }),
  confirmPrice: (id: number) =>
    apiRequest<JobOrderResponse>(`/api/orders/${id}/confirm-price`, {
      method: "PUT",
    }),
  assignDriver: (id: number, payload: { driverId: number }) =>
    apiRequest<JobOrderResponse>(`/api/orders/${id}/assign-driver`, {
      method: "PUT",
      body: payload,
    }),
  assignPickupRider: (id: number, payload: { driverId: number }) =>
    apiRequest<JobOrderResponse>(`/api/orders/${id}/assign-pickup-rider`, {
      method: "PUT",
      body: payload,
    }),
  assignDeliveryRider: (id: number, payload: { driverId: number }) =>
    apiRequest<JobOrderResponse>(`/api/orders/${id}/assign-delivery-rider`, {
      method: "PUT",
      body: payload,
    }),
};


export const usersApi = {
  listStaff: () => apiRequest<UserAdminRecord[]>("/api/admin/users/staff"),
  listStaffPaged: (params?: {
    page?: number;
    size?: number;
    sort?: string;
    direction?: "asc" | "desc";
    search?: string;
    role?: "STAFF" | "DRIVER";
    status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
    branch?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page != null) query.set("page", String(params.page));
    if (params?.size != null) query.set("size", String(params.size));
    if (params?.sort) query.set("sort", `${params.sort},${params.direction || "desc"}`);
    if (params?.search) query.set("search", params.search);
    if (params?.role) query.set("role", params.role);
    if (params?.status) query.set("status", params.status);
    if (params?.branch) query.set("branch", params.branch);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<PagedResponse<UserAdminRecord>>(`/api/admin/users/staff/paged${suffix}`);
  },
  listDrivers: (branch?: string) =>
    apiRequest<UserAdminRecord[]>(`/api/admin/users/drivers${branch ? `?branch=${encodeURIComponent(branch)}` : ""}`),
  createStaff: (payload: { fullName: string; email: string; role?: "STAFF" | "DRIVER"; branch?: string; initialPassword?: string }) =>
    apiRequest<UserAdminRecord>("/api/admin/users/staff", {
      method: "POST",
      body: payload,
    }),
  resendInvite: (id: number) =>
    apiRequest<void>(`/api/admin/users/staff/${id}/resend-invite`, {
      method: "POST",
    }),
  updateStatus: (id: number, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") =>
    apiRequest<void>(`/api/admin/users/staff/${id}/status`, {
      method: "PATCH",
      body: { status },
    }),
  updateStaff: (
    id: number,
    payload: { fullName: string; email: string; branch?: string; enabled: boolean },
  ) =>
    apiRequest<UserAdminRecord>(`/api/admin/users/staff/${id}`, {
      method: "PUT",
      body: payload,
    }),
  deleteStaff: (id: number) =>
    apiRequest<void>(`/api/admin/users/staff/${id}`, {
      method: "DELETE",
    }),
};

export const machinesApi = {
  list: () =>
    apiRequest<
      Array<{
        id: number;
        machineId: string;
        branch: string;
        type: "WASHER" | "DRYER";
        status: "AVAILABLE" | "IN_USE" | "MAINTENANCE";
        updatedAt: string;
      }>
    >("/api/machines"),
};

export const deliveriesApi = {
  assign: (payload: {
    trackingNumber: string;
    leg: "PICKUP_FROM_CUSTOMER" | "DELIVERY_TO_CUSTOMER";
    driverId?: number;
    driverName?: string;
    driverPhone?: string;
    notes?: string;
  }) =>
    apiRequest<{ id: number; trackingNumber: string; driverName: string; status: string }>("/api/deliveries", {
      method: "POST",
      body: payload,
    }),
  list: () => apiRequest<DeliveryRecord[]>("/api/deliveries"),
  track: (trackingNumber: string) =>
    apiRequest<DeliveryRecord>(`/api/deliveries/track/${encodeURIComponent(trackingNumber)}`),
  listPaged: (params?: {
    page?: number;
    size?: number;
    sort?: string;
    direction?: "asc" | "desc";
    branch?: string;
    status?: string;
    search?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page != null) query.set("page", String(params.page));
    if (params?.size != null) query.set("size", String(params.size));
    if (params?.sort) query.set("sort", `${params.sort},${params.direction || "desc"}`);
    if (params?.branch) query.set("branch", params.branch);
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<PagedResponse<DeliveryRecord>>(`/api/deliveries/paged${suffix}`);
  },
  create: (payload: {
    trackingNumber: string;
    driverName: string;
    driverPhone: string;
    estimatedArrivalAt?: string | null;
    notes?: string | null;
  }) =>
    apiRequest<DeliveryRecord>("/api/deliveries", {
      method: "POST",
      body: payload,
    }),
  updateStatus: (id: number, payload: { status: DeliveryRecord["status"]; notes?: string | null }) =>
    apiRequest<DeliveryRecord>(`/api/deliveries/${id}/status`, {
      method: "PUT",
      body: payload,
    }),
  assignRider: (
    id: number,
    payload: {
      driverName: string;
      driverPhone: string;
      estimatedArrivalAt?: string | null;
      notes?: string | null;
    },
  ) =>
    apiRequest<DeliveryRecord>(`/api/deliveries/${id}/assign-rider`, {
      method: "PUT",
      body: payload,
    }),
};

export const inventoryApi = {
  list: () => apiRequest<InventoryRecord[]>("/api/inventory"),
  create: (payload: {
    branch: string;
    itemName: string;
    category: string;
    unit: string;
    currentStock: number;
    reorderLevel: number;
  }) =>
    apiRequest<InventoryRecord>("/api/inventory/items", {
      method: "POST",
      body: payload,
    }),
  update: (
    id: number,
    payload: {
      branch: string;
      itemName: string;
      category: string;
      unit: string;
      reorderLevel: number;
    },
  ) =>
    apiRequest<InventoryRecord>(`/api/inventory/items/${id}`, {
      method: "PUT",
      body: payload,
    }),
  remove: (id: number) =>
    apiRequest<void>(`/api/inventory/items/${id}`, {
      method: "DELETE",
    }),
  adjust: (
    id: number,
    payload: { quantityDelta: number; direction: "IN" | "OUT"; reason: string },
  ) =>
    apiRequest<InventoryRecord>(`/api/inventory/items/${id}/adjust`, {
      method: "PATCH",
      body: payload,
    }),
  alerts: () =>
    apiRequest<InventoryRecord[]>("/api/inventory/alerts"),
  forecast: (days = 7) =>
    apiRequest<
      Array<{
        itemId: number;
        branch: string;
        itemName: string;
        currentStock: number;
        estimatedDailyUsage: number;
        projectedStockAfterDays: number;
        estimatedDaysUntilStockout: number;
      }>
    >(`/api/inventory/forecast?days=${days}`),
};

export const notificationsApi = {
  list: () => apiRequest<AppNotification[]>("/api/notifications"),
  listPaged: (params?: { page?: number; size?: number }) => {
    const query = new URLSearchParams();
    if (params?.page != null) query.set("page", String(params.page));
    if (params?.size != null) query.set("size", String(params.size));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<PagedResponse<AppNotification>>(`/api/notifications/paged${suffix}`);
  },
};

export const announcementsApi = {
  list: () => apiRequest<AnnouncementRecord[]>("/api/announcements"),
  create: (payload: { title: string; message: string; type: AnnouncementType; branch?: string }) =>
    apiRequest<AnnouncementRecord>("/api/announcements", {
      method: "POST",
      body: payload,
    }),
};

export const analyticsApi = {
  summary: (params?: { fromDate?: string; toDate?: string; branch?: string }) => {
    const query = new URLSearchParams();
    if (params?.fromDate) query.set("fromDate", params.fromDate);
    if (params?.toDate) query.set("toDate", params.toDate);
    if (params?.branch) query.set("branch", params.branch);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<{
      fromDate: string;
      toDate: string;
      totalOrders: number;
      pending: number;
      washing: number;
      drying: number;
      ready: number;
      totalRevenue: number;
      peakHour: number | null;
      branchBreakdown: Array<{ branch: string; totalOrders: number; revenue: number }>;
      hourlyBreakdown: Record<string, number>;
      paymentMethodBreakdown: Record<string, number>;
    }>(`/api/analytics/summary${suffix}`);
  },
};

export const supportApi = {
  chat: (message: string, sessionId: string, trackingNumber?: string) =>
    apiRequest<{
      category: string;
      reply: string;
      escalated: boolean;
      escalationTicket: string | null;
      data: unknown;
    }>("/api/support/chat", {
      method: "POST",
      body: { message, sessionId, trackingNumber },
    }),
  history: (sessionId: string) =>
    apiRequest<{
      messages: Array<{
        id: number;
        senderType: "USER" | "AI" | "HUMAN";
        message: string;
        category: string;
        escalationTicket: string | null;
        createdAt: string;
      }>;
      tickets: Array<{
        ticketNumber: string;
        issue: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>(`/api/support/history?sessionId=${encodeURIComponent(sessionId)}`),
  allTickets: () =>
    apiRequest<
      Array<{
        ticketNumber: string;
        issue: string;
        sessionId: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>
    >("/api/support/tickets"),
  resolveTicket: (ticketNumber: string) =>
    apiRequest<{
      ticketNumber: string;
      sessionId: string;
      issue: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>(`/api/support/tickets/${encodeURIComponent(ticketNumber)}/resolve`, {
      method: "PATCH",
    }),
  replyToTicket: (ticketNumber: string, message: string) =>
    apiRequest<void>(`/api/support/tickets/${encodeURIComponent(ticketNumber)}/reply`, {
      method: "POST",
      body: { message },
    }),
  history: (sessionId: string) =>
    apiRequest<{
      messages: Array<{
        id: number;
        senderType: string;
        message: string;
        category: string;
        escalationTicket: string | null;
        createdAt: string;
      }>;
    }>(`/api/support/history?sessionId=${encodeURIComponent(sessionId)}`),
};
