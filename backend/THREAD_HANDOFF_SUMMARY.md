# WashAlert Backend Handoff Summary (Copy/Paste)

## What Was Completed

### 1) Booking Management (Module 1)
- Added public booking API with branch/date slot lookup and booking creation.
- Added booking fields to `JobOrder`:
  - service type, booking date/time slot
  - detergent/fabric preference
  - load size and estimated weight
  - customer contact + delivery address
- Added slot-capacity validation based on active machines.
- Added booking confirmation tracking number generation.

### 2) Real-Time Order Tracking (Module 2)
- Added public tracking endpoint by tracking number.
- Added timeline history table and logging (`job_order_status_history`).
- Logs are created on booking/order creation and on each status update.

### 3) Inventory Module (Module 3 MVP)
- Added inventory items, stock adjustment, movement history, low-stock alerts, and forecast endpoint.
- Added branch-based access restrictions for staff.
- Added duplicate prevention for item per branch (`branch + item_name` uniqueness).

### 4) Delivery Module (Module 4 MVP)
- Added delivery assignment, listing, status update, location update, and public tracking endpoint.
- Restricted delivery to `PICKUP_DELIVERY` orders only.
- Added delivery state machine guard and branch authorization checks.

### 5) Payment Module (Module 5 MVP)
- Added proof submission + payment verification endpoints.
- Added payment tracking endpoint.
- Added verification guard: only `PENDING` payments can be verified.
- Added re-submission guard: verified/paid records cannot be overwritten.

### 6) Analytics Module (Module 6 MVP)
- Added analytics summary endpoint:
  - order counts by status
  - revenue totals
  - peak order hour
  - branch breakdown

### 7) Natural Language Reporting (Module 7 MVP)
- Added NL report endpoint with intent routing for:
  - analytics summary
  - inventory alerts
  - delivery overview
- Staff branch scope is enforced.

### 8) Chat Support (Module 8 MVP)
- Added support chat endpoint for:
  - FAQ responses
  - tracking lookups
  - complaint escalation ticket generation
- Unknown tracking now returns a friendly chat reply instead of crashing flow.

---

## Reliability / Hardening Work Completed

1. **Status transition guards**
- Job orders: `PENDING -> WASHING -> DRYING -> READY`
- Deliveries: `PENDING_PICKUP -> PICKED_UP -> IN_TRANSIT -> DELIVERED` (with `FAILED` path)

2. **Booking race-condition prevention**
- Added pessimistic DB lock on branch machines during booking creation:
  - `MachineRepository.lockByBranch(...)`
- Prevents concurrent overbooking races for same branch/slot window.

3. **Webhook verification + retries (Payment)**
- Added payment webhook endpoint with HMAC signature verification.
- Added webhook event persistence, processing statuses, retries, and dead-letter behavior.
- Added scheduled retry job for failed/received webhook events.

4. **Notification queue + retry/dead-letter**
- Added queue table for notifications with statuses:
  - `PENDING`, `SENT`, `FAILED`, `DEAD`
- Added scheduled processor with retry/backoff logic.
- Integrated queueing into major events:
  - booking created
  - order status updated
  - payment proof submitted / verified / webhook-updated
  - delivery assigned / delivery status updated

5. **Error handling consistency**
- Removed duplicate exception advice.
- Added `IllegalStateException -> 409 Conflict` mapping.
- Added `SecurityException -> 401 Unauthorized` mapping.

---

## New/Updated Public Endpoints

- `GET /api/bookings/slots`
- `POST /api/bookings`
- `GET /api/orders/track/{trackingNumber}`
- `POST /api/payments/proof`
- `GET /api/payments/track/{trackingNumber}`
- `POST /api/payments/webhook`
- `GET /api/deliveries/track/{trackingNumber}`
- `POST /api/support/chat`

## New Staff/Admin Endpoints

- Inventory:
  - `GET /api/inventory`
  - `POST /api/inventory/items`
  - `PATCH /api/inventory/items/{itemId}/adjust`
  - `GET /api/inventory/alerts`
  - `GET /api/inventory/forecast`
- Payments:
  - `GET /api/payments`
  - `PUT /api/payments/{paymentId}/verify`
- Deliveries:
  - `POST /api/deliveries`
  - `GET /api/deliveries`
  - `GET /api/deliveries/{deliveryId}`
  - `PUT /api/deliveries/{deliveryId}/status`
  - `PUT /api/deliveries/{deliveryId}/location`
- Analytics / Reports:
  - `GET /api/analytics/summary`
  - `POST /api/reports/nl`

---

## Webhook Signature Rule (for Integrations)

Header required:
- `X-WashAlert-Signature`

HMAC SHA-256 (hex lowercase) over canonical payload:
- `eventId|provider|trackingNumber|referenceNumber|amount|status`

Secret source:
- `washalert.payment.webhook.secret`

---

## Config Added

`application.yaml`:
- `washalert.payment.webhook.secret`
- `washalert.payment.webhook.max-attempts`
- `washalert.payment.webhook.retry-delay-minutes`
- `washalert.payment.webhook.retry-interval-ms`
- `washalert.notification.max-attempts`
- `washalert.notification.retry-delay-minutes`
- `washalert.notification.process-interval-ms`

`application-test.yaml`:
- Added test OAuth2 client values to avoid context failures in tests.

---

## Validation

Command used:
- `.\\mvnw.cmd -q -s local-maven-settings.xml test`

Result:
- PASS

---

## Remaining High-Value Next Steps

1. Replace proof-only payment flow with real GCash/Maya webhook/provider SDK integration end-to-end.
2. Add SMS channel implementation into notification queue (`NotificationChannel.SMS`) with provider retry semantics.
3. Add controller-level integration tests for booking/webhook/notification-triggering endpoints.
4. Add idempotency keys for booking creation endpoint to protect client retries.
