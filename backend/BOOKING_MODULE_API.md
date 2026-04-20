# Booking Module API (Module 1)

## Base Path
`/api/bookings`

## 1) Get Available Booking Slots

`GET /api/bookings/slots?branch={branchName}&date={YYYY-MM-DD}`

Example:
`GET /api/bookings/slots?branch=Light&date=2026-03-30`

Response:
```json
[
  {
    "date": "2026-03-30",
    "slotStartTime": "08:00:00",
    "slotEndTime": "09:30:00",
    "capacity": 3,
    "bookedCount": 1,
    "slotsRemaining": 2,
    "available": true
  }
]
```

## 2) Create Booking

`POST /api/bookings`

Request body:
```json
{
  "customerName": "Juan Dela Cruz",
  "branch": "Light",
  "customerPhone": "09171234567",
  "customerEmail": "juan@example.com",
  "serviceType": "DROP_OFF",
  "preferredDate": "2026-03-30",
  "preferredSlotStartTime": "10:00:00",
  "detergentPreference": "Mild",
  "fabricConditionerPreference": "Lavender",
  "loadSize": "MEDIUM",
  "estimatedWeightKg": 4.5,
  "specialInstructions": "Please separate whites and colored clothes.",
  "deliveryAddress": null
}
```

Success response returns a `JobOrderResponse` including generated tracking number (example `WA-10045`).

## Business Rules Implemented

1. Selected date cannot be in the past.
2. Slot must be within business hours.
3. Slot capacity is based on active machines (excluding `MAINTENANCE`) in the selected branch.
4. If selected slot is full, booking is rejected.
5. `PICKUP_DELIVERY` requires `deliveryAddress`.
6. Every booking gets a unique tracking number.

## Configurable Booking Settings

In `application.yaml`:
- `washalert.booking.open-hour`
- `washalert.booking.close-hour`
- `washalert.booking.slot-minutes`
