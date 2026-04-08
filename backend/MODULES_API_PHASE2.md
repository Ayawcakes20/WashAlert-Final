# WashAlert Backend - Implemented Modules (After Booking)

This document lists the additional modules implemented after Booking Management.

## Module 2: Real-Time Order Tracking

### Endpoints
- `GET /api/orders/track/{trackingNumber}` (public)

### Notes
- Added status timeline storage in `job_order_status_history`.
- Timeline is recorded on order creation and every status update.

---

## Module 3: Predictive Inventory Management (MVP)

### Endpoints
- `GET /api/inventory?branch=Light` (admin/staff)
- `POST /api/inventory/items` (admin)
- `PATCH /api/inventory/items/{itemId}/adjust` (admin/staff)
- `GET /api/inventory/alerts` (admin/staff)
- `GET /api/inventory/forecast?days=7&branch=Light` (admin/staff)

### Notes
- Supports per-branch stock visibility.
- Records inventory movements.
- Forecast uses recent consumption trend (last 30 days).
- `adjust.direction` now uses strict enum values: `IN` or `OUT`.

---

## Module 4: Delivery Tracking and Management (MVP)

### Endpoints
- `POST /api/deliveries` (admin/staff)
- `GET /api/deliveries` (admin/staff)
- `GET /api/deliveries/{deliveryId}` (admin/staff)
- `PUT /api/deliveries/{deliveryId}/status` (admin/staff)
- `PUT /api/deliveries/{deliveryId}/location` (admin/staff)
- `GET /api/deliveries/track/{trackingNumber}` (public)

### Notes
- Delivery assignment is allowed only for `PICKUP_DELIVERY` orders.
- Includes driver info, status, live location, and ETA.

---

## Module 5: Digital Payment Module (MVP)

### Endpoints
- `POST /api/payments/proof` (public)
- `GET /api/payments/track/{trackingNumber}` (public)
- `GET /api/payments?branch=Light` (admin/staff)
- `PUT /api/payments/{paymentId}/verify` (admin/staff)

### Notes
- Supports `GCASH`, `MAYA`, and `CASH` methods.
- Customer submits proof; staff/admin verifies or rejects.

---

## Module 6: AI-Driven Analytics Dashboard (MVP Backend)

### Endpoints
- `GET /api/analytics/summary?fromDate=2026-03-01&toDate=2026-03-31&branch=All` (admin/staff)

### Metrics
- Order totals by status
- Revenue totals from verified/paid records
- Peak order hour
- Branch breakdown

---

## Module 7: Natural Language Reporting Interface (Template-Based MVP)

### Endpoints
- `POST /api/reports/nl` (admin/staff)

### Request Example
```json
{
  "query": "Show revenue and peak hour for this week",
  "fromDate": "2026-03-22",
  "toDate": "2026-03-29",
  "branch": "All"
}
```

### Notes
- Detects intents (analytics/inventory/delivery) from natural language query.
- Returns structured report payload.

---

## Module 8: Agentic AI Chat Support (MVP)

### Endpoints
- `POST /api/support/chat` (public)

### Request Example
```json
{
  "message": "Track my order WA-10021"
}
```

### Notes
- Handles FAQ-like responses.
- Supports tracking status lookup.
- Supports complaint escalation ticket generation.

---

## Build Status
- Verified by running: `.\\mvnw.cmd -q -s local-maven-settings.xml test`
- Result: **PASS**

---

## Hardening Pass (Logic-Gap Prevention)

1. Added strict job-order status transition rules (`PENDING -> WASHING -> DRYING -> READY`).
2. Added strict delivery status transition rules (`PENDING_PICKUP -> PICKED_UP -> IN_TRANSIT -> DELIVERED`).
3. Prevented re-verification/replacement of already verified/paid payments.
4. Enforced duplicate prevention for inventory items per branch (`branch + item_name`).
5. Added friendly tracking fallback in chat support (avoids throwing 4xx for unknown tracking in chat flow).
6. Removed duplicate exception handler and standardized conflict responses (`409`) for illegal state transitions.
7. Added automated regression tests for transition and payment-rule hardening.
