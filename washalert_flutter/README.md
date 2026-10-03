# WashAlert Flutter Customer Prototype

A school demo based on the customer UI in the existing WashAlert mobile app.
Built with Flutter Material 3 and local in-memory state. No server, database,
Firebase, maps API or payment gateway is connected.

## Run

```powershell
flutter pub get
flutter run
```

Android is the main target. The existing Flutter platform folders are retained.
Use **Try the demo account** or register a local customer. Use sample details,
not real account passwords. Local accounts and bookings reset on app restart.

## Demonstration

1. Sign in, choose Book Laundry, and complete Package, Location, Extras,
   Schedule, Payment and Confirm.
2. View the WA-YYYY-XXXXX order in My Orders. Edit or cancel an unpaid Pending
   booking, or remove it from the session.
3. Open Order Details > Presentation Controls. Advance the order to the branch
   and Awaiting Price Confirmation. Verify the actual weight (5-9 kg).
4. Confirm Final Price. Use the Payment Simulation screen for GCash or cash.
5. Advance Washing, Drying and Ready. Delivery orders include the outbound rider
   stages; Pick Up orders finish with Picked Up. Payment is required for release.
6. Track Order shows the local timeline. Updates lists booking progress events.
7. Edit Profile, sign out and sign back in to demonstrate local account isolation.

## Structure

- `lib/models/`: customer, catalog, booking and price models
- `lib/data/`: copied customer catalog and ChangeNotifier state
- `lib/screens/`: authentication, customer navigation and customer flows
- `lib/widgets/`: reusable layouts, order card and receipt summary
- `lib/theme/`: WashAlert navy, blue, mint and Material 3 styling
- `assets/images/`: copied WashAlert logo and service illustrations

The reference is `mobile/src/screens/customer/BookingScreen.jsx`, customer
home/orders/details/profile/tracking, and the mobile theme/catalog. Small/Large
load estimates are 5/8 kg. Customer Provided supplies have quantity 0 and no fee;
Dry Only disables shop supplies. Pricing is a local simulation of the mobile
estimate. Delivery uses a labelled PHP 50 estimate with no distance calculation.
No live supply stock or actual staff/rider account is simulated.

## Checks

```powershell
flutter analyze
flutter test
```
