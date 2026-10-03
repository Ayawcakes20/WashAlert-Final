import 'package:flutter_test/flutter_test.dart';
import 'package:washalert_flutter/data/app_state.dart';
import 'package:washalert_flutter/data/catalog.dart';
import 'package:washalert_flutter/models/booking.dart';

void main() {
  late AppState state;
  setUp(() {
    state = AppState();
    state.login(AppState.demoEmail, AppState.demoPassword);
  });
  tearDown(() => state.dispose());

  test('create, read, update and remove an unpaid Pending booking', () {
    final draft = state.newDraft()..mode = ServiceMode.pickUp;
    final b = state.createBooking(draft);
    expect(b.trackingId, matches(r'^WA-\d{4}-\d{5}$'));
    expect(state.findBooking(b.trackingId), b);
    draft.instructions = 'Please separate whites.';
    expect(b.draft.instructions, isEmpty);
    state.updateBooking(b.trackingId, draft);
    expect(b.draft.instructions, 'Please separate whites.');
    state.removeBooking(b.trackingId);
    expect(state.bookings, isEmpty);
  });

  test('cancel keeps history and prevents processing or editing', () {
    final b = state.createBooking(state.newDraft());
    state.cancelBooking(b.trackingId);
    expect(b.status, OrderStatus.cancelled);
    expect(state.bookings.length, 1);
    expect(
      () => state.updateBooking(b.trackingId, state.newDraft()),
      throwsStateError,
    );
    expect(() => state.advanceStatus(b.trackingId), throwsStateError);
    state.removeBooking(b.trackingId);
    expect(state.bookings, isEmpty);
  });

  test('same branch and schedule cannot be submitted twice', () {
    final draft = state.newDraft();
    state.createBooking(draft);
    expect(() => state.createBooking(draft), throwsStateError);
    draft.slot = Catalog.slots[1];
    state.createBooking(draft);
    expect(state.bookings.length, 2);
  });

  test('Dry Only and Customer Provided have zero supply quantity and cost', () {
    final draft = state.newDraft()
      ..service = Catalog.services[1]
      ..detergent = Catalog.detergents.first
      ..detergentQty = 2
      ..conditioner = Catalog.conditioners.first
      ..conditionerQty = 1;
    final b = state.createBooking(draft);
    expect(b.draft.detergent, isNull);
    expect(b.draft.conditionerQty, 0);
    expect(b.breakdown.detergent + b.breakdown.conditioner, 0);
    final own = BookingDraft(detergentQty: 8)..normalizeSupplies();
    expect(own.detergentQty, 0);
  });

  test('AM and PM slots reject only past times', () {
    final date = DateTime(2026, 10, 3);
    final now = DateTime(2026, 10, 3, 12, 45);
    expect(
      Catalog.slotAvailable(date, '11:00 AM - 12:30 PM', now: now),
      isFalse,
    );
    expect(Catalog.slotAvailable(date, '1:00 PM - 2:30 PM', now: now), isTrue);
    expect(
      Catalog.slotAvailable(
        date.add(const Duration(days: 1)),
        Catalog.slots.first,
        now: now,
      ),
      isTrue,
    );
  });

  test(
    'finalized GCash amount is shared and paid gate works through completion',
    () {
      final draft = state.newDraft()
        ..mode = ServiceMode.pickUp
        ..paymentMethod = PaymentMethod.gcash;
      final b = state.createBooking(draft);
      expect(() => state.pay(b.trackingId), throwsStateError);
      state.advanceStatus(b.trackingId);
      state.advanceStatus(b.trackingId);
      state.finalizePrice(b.trackingId, 8);
      expect(b.total, 245);
      state.advanceStatus(b.trackingId);
      expect(() => state.advanceStatus(b.trackingId), throwsStateError);
      state.pay(b.trackingId);
      expect(b.isPaid, isTrue);
      expect(() => state.pay(b.trackingId), throwsStateError);
      while (b.nextStatus != null) {
        state.advanceStatus(b.trackingId);
      }
      expect(b.statusLabel, 'Picked Up');
      expect(b.workflow.contains(OrderStatus.outForDelivery), isFalse);
    },
  );

  test('delivery completes only after simulated cash collection', () {
    final b = state.createBooking(state.newDraft());
    while (b.nextStatus != OrderStatus.delivered) {
      state.advanceStatus(b.trackingId);
    }
    expect(() => state.advanceStatus(b.trackingId), throwsStateError);
    state.pay(b.trackingId);
    state.advanceStatus(b.trackingId);
    expect(b.statusLabel, 'Delivered Successfully');
    expect(
      () => state.updateBooking(b.trackingId, state.newDraft()),
      throwsStateError,
    );
  });

  test(
    'local accounts see only their own bookings and profile is editable',
    () {
      final b = state.createBooking(state.newDraft());
      state.register(
        fullName: 'Student Customer',
        email: 'student@example.com',
        phone: '09999999999',
        address: 'Sample address',
        password: 'Example123',
      );
      expect(state.bookings, isEmpty);
      expect(state.findBooking(b.trackingId), isNull);
      state.updateProfile('New Customer', '09888888888', 'Updated address');
      expect(state.newDraft().contactName, 'New Customer');
      state.logout();
      state.login(AppState.demoEmail, AppState.demoPassword);
      expect(state.findBooking(b.trackingId), b);
    },
  );
}
