# WashAlert Revised Doc - Module Gap Analysis

Based on `WashAlertRevised.docx`, these are the required modules and current backend status.

## Required Modules From Revised Scope

1. Branch-Based Booking Management
2. Real-Time Order Tracking
3. Predictive Inventory Management
4. Delivery Tracking and Management
5. Digital Payment (GCash/Maya)
6. AI-Driven Analytics and Reporting
7. Natural Language Reporting Interface
8. Agentic AI Chat Support

## Current Backend Status vs Required Modules

### 1) Branch-Based Booking Management
Status: PARTIAL

Already available:
- Account auth and role system (admin/staff)
- Job order creation with branch + tracking number

Missing for revised scope:
- Customer booking endpoint (public/auth customer flow)
- Available time slots based on machine capacity
- Service preferences (detergent, fabric conditioner, load size, est. weight, instructions)
- Booking calendar logic and slot conflicts

### 2) Real-Time Order Tracking
Status: PARTIAL

Already available:
- Order lifecycle status updates (`PENDING`, `WASHING`, `DRYING`, `READY`)
- Tracking number generation

Missing:
- Public/customer tracking endpoint by tracking number
- Push/SMS/in-app notifications on status change
- Optional event stream (WebSocket/SSE) for live updates

### 3) Predictive Inventory Management
Status: NOT STARTED

Missing:
- Inventory items and stock movement tables
- Consumption logging per order
- Reorder threshold and low-stock alerts
- Forecasting logic (even basic moving average)

### 4) Delivery Tracking and Management
Status: NOT STARTED

Missing:
- Driver accounts/roles
- Delivery jobs (pickup/drop-off)
- Assignment + route + ETA + status flow
- Driver location updates + customer tracking view

### 5) Digital Payment Module (GCash/Maya)
Status: NOT STARTED

Missing:
- Payment record lifecycle (`PENDING`, `PAID`, `FAILED`, `REFUNDED`)
- Payment gateway integration or proof-of-payment workflow
- Webhook verification and reconciliation

### 6) AI-Driven Analytics and Reporting
Status: PARTIAL

Already available:
- Basic dashboard summaries for orders and machines

Missing:
- Revenue and branch comparison analytics
- Peak-hour analysis, staff productivity metrics
- Exportable reports (daily/weekly/monthly)

### 7) Natural Language Reporting Interface
Status: NOT STARTED

Missing:
- NL query endpoint and prompt-to-report parser
- Guardrails for allowed query intents
- Mapping natural language to report templates

### 8) Agentic AI Chat Support
Status: NOT STARTED

Missing:
- Chat session and message storage
- FAQ + order tracking tool actions
- Escalation flow to staff

## Recommended 3-Week Backend Sequence

Week 1 (Core operations):
- Complete Booking Management (customer booking + service preferences + slot validation)
- Complete Real-Time Tracking API (customer tracking endpoint + status timeline)
- Add notifications baseline (email now; SMS optional if time allows)

Week 2 (Business-critical modules):
- Implement Inventory Management (stock, usage, low-stock alerts)
- Implement Payment module baseline (proof-of-payment + staff verification OR direct gateway if ready)
- Extend analytics for branch/revenue/peak hour

Week 3 (Advanced/demo-critical):
- Implement Delivery module (driver assignment + delivery status + map-ready coordinates)
- Implement NL reporting (template-based conversational reporting)
- Implement AI chat support MVP (FAQ + order lookup + escalation)

## Suggested MVP Cutline (if schedule gets tight)

Must-have for defense:
- Booking + Tracking + Inventory + Payment + Analytics (non-AI)

Good-to-have:
- Delivery live map

Stretch goals:
- Natural Language Reporting and Agentic Chat Support
