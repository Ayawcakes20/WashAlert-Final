package com.washalert.washalertbackend.delivery;

public enum DeliveryStatus {

    // ── Phase A: Inbound (Dirty Laundry) ─────────────────────────────────────
    ASSIGNED_PICKUP,      // Driver accepted; navigating to customer
    ARRIVED_CUSTOMER,     // Driver at customer; bag count + photo verification
    PICKED_UP,            // Bags collected; heading to branch
    ARRIVED_BRANCH,       // At branch; photo handover to staff
    HANDED_TO_BRANCH,     // Phase A complete. Driver is FREE.

    // ── Phase B: Outbound (Clean Laundry) ────────────────────────────────────
    ASSIGNED_DELIVERY,    // In pool; waiting for driver (or staff-assigned)
    OUT_FOR_DELIVERY,     // Driver en route to customer with clean laundry
    ARRIVED_DELIVERY,     // At customer; confirmation code + photo required
    DELIVERED,            // Fully complete. Order closed.

    // ── Legacy States (kept for backward compatibility) ───────────────────────
    PENDING_PICKUP,
    EN_ROUTE_TO_PICKUP,
    IN_TRANSIT,

    // ── Error States ──────────────────────────────────────────────────────────
    FAILED,
    CANCELLED
}
