import 'package:flutter/material.dart';
import '../models/booking.dart';
import '../models/customer.dart';
import 'catalog.dart';

class AppState extends ChangeNotifier {
  AppState() {
    _customers.add(
      Customer(
        id: 1,
        fullName: 'Demo Customer',
        email: demoEmail,
        phone: '09123456789',
        address: 'Demo address, Makati City',
      ),
    );
    _passwords[1] = demoPassword;
  }
  static const demoEmail = 'customer@washalert.demo';
  static const demoPassword = 'WashAlert123';
  final List<Customer> _customers = [];
  // Credentials exist only in memory for the school simulation. Never use real passwords.
  final Map<int, String> _passwords = {};
  final List<Booking> _bookings = [];
  Customer? customer;
  int _nextId = 1;

  List<Booking> get bookings => _bookings
      .where((b) => b.customerId == customer?.id)
      .toList()
      .reversed
      .toList();
  Booking? findBooking(String id) {
    for (final b in bookings) {
      if (b.trackingId == id) return b;
    }
    return null;
  }

  void login(String email, String password) {
    Customer? match;
    for (final user in _customers) {
      if (user.email == email.trim().toLowerCase()) match = user;
    }
    if (match == null || _passwords[match.id] != password) {
      throw StateError(
        'Email or password is incorrect. Register a local account or use the demo login.',
      );
    }
    customer = match;
    notifyListeners();
  }

  void register({
    required String fullName,
    required String email,
    required String phone,
    required String address,
    required String password,
  }) {
    final normalized = email.trim().toLowerCase();
    if (_customers.any((u) => u.email == normalized)) {
      throw StateError(
        'An account with this email already exists in this session.',
      );
    }
    final user = Customer(
      id: _customers.length + 1,
      fullName: fullName.trim(),
      email: normalized,
      phone: phone.trim(),
      address: address.trim(),
    );
    _customers.add(user);
    _passwords[user.id] = password;
    customer = user;
    notifyListeners();
  }

  void logout() {
    customer = null;
    notifyListeners();
  }

  void updateProfile(String name, String phone, String address) {
    final user = customer;
    if (user == null) throw StateError('Please log in first.');
    user.fullName = name.trim();
    user.phone = phone.trim();
    user.address = address.trim();
    notifyListeners();
  }

  BookingDraft newDraft() => BookingDraft(
    address: customer?.address ?? '',
    contactName: customer?.fullName ?? '',
    contactPhone: customer?.phone ?? '',
  );

  void _validateDraft(BookingDraft draft) {
    if (customer == null) throw StateError('Please log in before booking.');
    if (!Catalog.slotAvailable(draft.date, draft.slot)) {
      throw StateError(
        'Choose an upcoming time slot. This slot has already started.',
      );
    }
    if (draft.mode == ServiceMode.delivery) {
      if (draft.address.trim().isEmpty) {
        throw StateError('Please enter your pickup and delivery address.');
      }
      if (draft.contactName.trim().isEmpty ||
          !RegExp(r'^09\d{9}$').hasMatch(draft.contactPhone.trim())) {
        throw StateError(
          'Enter a contact name and a valid Philippine mobile number.',
        );
      }
    }
    if (draft.detergentQty < 0 ||
        draft.conditionerQty < 0 ||
        draft.detergentQty > 10 ||
        draft.conditionerQty > 10) {
      throw StateError('Supply quantity must be between 0 and 10.');
    }
    draft.normalizeSupplies();
    if ((draft.detergent != null && draft.detergentQty == 0) ||
        (draft.conditioner != null && draft.conditionerQty == 0)) {
      throw StateError('Select at least one pack for shop-provided supplies.');
    }
  }

  Booking createBooking(BookingDraft draft) {
    _validateDraft(draft);
    final duplicate = bookings.any(
      (b) =>
          b.isPending &&
          b.draft.branch == draft.branch &&
          b.draft.slot == draft.slot &&
          DateUtils.isSameDay(b.draft.date, draft.date) &&
          b.createdAt.isAfter(
            DateTime.now().subtract(const Duration(minutes: 1)),
          ),
    );
    if (duplicate) {
      throw StateError(
        'You already booked this branch and schedule. View or edit your Pending booking.',
      );
    }
    final id =
        'WA-${DateTime.now().year}-${(_nextId++).toString().padLeft(5, '0')}';
    final booking = Booking(
      trackingId: id,
      customerId: customer!.id,
      draft: draft,
    );
    _bookings.add(booking);
    notifyListeners();
    return booking;
  }

  Booking _requireBooking(String id) =>
      findBooking(id) ??
      (throw StateError('This booking is no longer available.'));
  void updateBooking(String id, BookingDraft draft) {
    final b = _requireBooking(id);
    if (!b.isPending || b.isPaid) {
      throw StateError('Only unpaid Pending bookings can be edited.');
    }
    _validateDraft(draft);
    b.draft = draft.copy();
    notifyListeners();
  }

  void cancelBooking(String id) {
    final b = _requireBooking(id);
    if (!b.isPending || b.isPaid) {
      throw StateError('Only unpaid Pending bookings can be cancelled.');
    }
    b.status = OrderStatus.cancelled;
    b.events.add(StatusEvent(b.status, DateTime.now()));
    notifyListeners();
  }

  void removeBooking(String id) {
    final b = _requireBooking(id);
    if ((!b.isPending && b.status != OrderStatus.cancelled) || b.isPaid) {
      throw StateError(
        'Only unpaid Pending or cancelled bookings can be removed.',
      );
    }
    _bookings.remove(b);
    notifyListeners();
  }

  void finalizePrice(String id, double kg) {
    final b = _requireBooking(id);
    if (b.status != OrderStatus.awaitingPriceConfirmation || b.isPaid) {
      throw StateError(
        'Weight can be verified while awaiting price confirmation.',
      );
    }
    if (!kg.isFinite || kg < 5 || kg > 9) {
      throw StateError(
        'Use a verified weight between 5 and 9 kg for this demo.',
      );
    }
    b.actualKg = kg;
    b.finalPrice = b.breakdown.total;
    notifyListeners();
  }

  void advanceStatus(String id) {
    final b = _requireBooking(id);
    final next = b.nextStatus;
    if (next == null) throw StateError('This order is already closed.');
    if (next == OrderStatus.priceConfirmed && b.finalPrice == null) {
      throw StateError('Verify the weight and final price first.');
    }
    if (next == OrderStatus.washing &&
        b.draft.paymentMethod == PaymentMethod.gcash &&
        !b.isPaid) {
      throw StateError('Complete the simulated GCash payment before washing.');
    }
    if (next == OrderStatus.delivered && !b.isPaid) {
      throw StateError(
        'Confirm the simulated payment before releasing the laundry.',
      );
    }
    b.status = next;
    b.events.add(StatusEvent(next, DateTime.now()));
    if (next == OrderStatus.awaitingPriceConfirmation) {
      b.actualKg = b.draft.estimatedKg;
      b.finalPrice = b.breakdown.total;
    }
    notifyListeners();
  }

  void pay(String id) {
    final b = _requireBooking(id);
    if (b.isPaid) throw StateError('Payment already confirmed.');
    if (b.isClosed || b.finalPrice == null) {
      throw StateError(
        'Payment becomes available after the branch verifies the final price.',
      );
    }
    b.isPaid = true;
    b.paidAt = DateTime.now();
    b.paymentReference = 'DEMO-${b.trackingId}';
    notifyListeners();
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
    : super(notifier: state);
  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
