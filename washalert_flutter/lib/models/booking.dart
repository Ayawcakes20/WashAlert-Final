import '../data/catalog.dart';
import 'catalog_models.dart';

enum ServiceMode { delivery, pickUp }

enum PaymentMethod { cash, gcash }

enum OrderStatus {
  pending,
  assignedForPickup,
  enRouteToCustomer,
  laundryCollected,
  enRouteToBranch,
  orderReceived,
  awaitingPriceConfirmation,
  priceConfirmed,
  washing,
  drying,
  ready,
  assignedForDelivery,
  outForDelivery,
  delivered,
  cancelled;

  String label(ServiceMode mode) => switch (this) {
    pending => 'Pending',
    assignedForPickup => 'Rider Assigned for Pickup',
    enRouteToCustomer => 'Rider on the Way for Pickup',
    laundryCollected => 'Laundry Collected',
    enRouteToBranch => 'Heading to Branch',
    orderReceived => 'Order Received',
    awaitingPriceConfirmation => 'Awaiting Price Confirmation',
    priceConfirmed => 'Price Confirmed',
    washing => 'Washing in Progress',
    drying => 'Drying',
    ready =>
      mode == ServiceMode.delivery
          ? 'Ready for Delivery'
          : 'Ready for Pickup at Branch',
    assignedForDelivery => 'Rider Assigned for Delivery',
    outForDelivery => 'Out for Delivery',
    delivered =>
      mode == ServiceMode.delivery ? 'Delivered Successfully' : 'Picked Up',
    cancelled => 'Cancelled',
  };
}

class BookingDraft {
  BookingDraft({
    Branch? branch,
    LaundryService? service,
    this.mode = ServiceMode.delivery,
    this.largeLoad = false,
    this.address = '',
    this.unitFloor = '',
    this.contactName = '',
    this.contactPhone = '',
    this.detergent,
    this.conditioner,
    this.detergentQty = 0,
    this.conditionerQty = 0,
    DateTime? date,
    this.slot = '8:00 AM - 9:30 AM',
    this.rush = false,
    this.instructions = '',
    this.paymentMethod = PaymentMethod.cash,
  }) : branch = branch ?? Catalog.branches.first,
       service = service ?? Catalog.services[3],
       date = date ?? DateTime.now().add(const Duration(days: 1));
  Branch branch;
  LaundryService service;
  ServiceMode mode;
  bool largeLoad;
  String address;
  String unitFloor;
  String contactName;
  String contactPhone;
  Supply? detergent;
  Supply? conditioner;
  int detergentQty;
  int conditionerQty;
  DateTime date;
  String slot;
  bool rush;
  String instructions;
  PaymentMethod paymentMethod;
  double get estimatedKg => largeLoad ? 8 : 5;
  int get loadCount => service.loadsFor(estimatedKg);
  String get modeLabel => mode == ServiceMode.delivery ? 'Delivery' : 'Pick Up';
  String get paymentLabel => paymentMethod == PaymentMethod.gcash
      ? 'GCash / QRPh'
      : 'Cash on Delivery / Pick Up';
  BookingDraft copy() => BookingDraft(
    branch: branch,
    service: service,
    mode: mode,
    largeLoad: largeLoad,
    address: address,
    unitFloor: unitFloor,
    contactName: contactName,
    contactPhone: contactPhone,
    detergent: detergent,
    conditioner: conditioner,
    detergentQty: detergentQty,
    conditionerQty: conditionerQty,
    date: date,
    slot: slot,
    rush: rush,
    instructions: instructions,
    paymentMethod: paymentMethod,
  );
  void normalizeSupplies() {
    if (service.dryOnly) {
      detergent = null;
      conditioner = null;
    }
    if (detergent == null) detergentQty = 0;
    if (conditioner == null) conditionerQty = 0;
  }
}

class PriceBreakdown {
  PriceBreakdown(BookingDraft draft, {double? actualKg}) {
    final kg = actualKg ?? draft.estimatedKg;
    service = draft.service.priceFor(kg);
    extraWeight = kg > 8 ? (kg - 8) * 50 : 0;
    detergent = draft.service.dryOnly || draft.detergent == null
        ? 0
        : draft.detergent!.unitPrice * draft.detergentQty;
    conditioner = draft.service.dryOnly || draft.conditioner == null
        ? 0
        : draft.conditioner!.unitPrice * draft.conditionerQty;
    rush = draft.rush ? 150 : 0;
    // Logistics is a labelled local estimate because this prototype has no map/distance API.
    delivery = draft.mode == ServiceMode.delivery ? 50 : 0;
  }
  late final double service;
  late final double extraWeight;
  late final double detergent;
  late final double conditioner;
  late final double rush;
  late final double delivery;
  double get total =>
      service + extraWeight + detergent + conditioner + rush + delivery;
}

class StatusEvent {
  const StatusEvent(this.status, this.at);
  final OrderStatus status;
  final DateTime at;
}

class Booking {
  Booking({
    required this.trackingId,
    required this.customerId,
    required BookingDraft draft,
  }) : draft = draft.copy(),
       createdAt = DateTime.now(),
       events = [StatusEvent(OrderStatus.pending, DateTime.now())];
  final String trackingId;
  final int customerId;
  final DateTime createdAt;
  BookingDraft draft;
  OrderStatus status = OrderStatus.pending;
  bool isPaid = false;
  DateTime? paidAt;
  String? paymentReference;
  double? actualKg;
  double? finalPrice;
  final List<StatusEvent> events;
  bool get isPending => status == OrderStatus.pending;
  bool get isClosed =>
      status == OrderStatus.delivered || status == OrderStatus.cancelled;
  PriceBreakdown get breakdown => PriceBreakdown(draft, actualKg: actualKg);
  double get total => finalPrice ?? breakdown.total;
  String get statusLabel => status.label(draft.mode);
  List<OrderStatus> get workflow => [
    OrderStatus.pending,
    if (draft.mode == ServiceMode.delivery) ...[
      OrderStatus.assignedForPickup,
      OrderStatus.enRouteToCustomer,
      OrderStatus.laundryCollected,
      OrderStatus.enRouteToBranch,
    ],
    OrderStatus.orderReceived,
    OrderStatus.awaitingPriceConfirmation,
    OrderStatus.priceConfirmed,
    OrderStatus.washing,
    OrderStatus.drying,
    OrderStatus.ready,
    if (draft.mode == ServiceMode.delivery) ...[
      OrderStatus.assignedForDelivery,
      OrderStatus.outForDelivery,
    ],
    OrderStatus.delivered,
  ];
  OrderStatus? get nextStatus {
    if (isClosed) return null;
    final i = workflow.indexOf(status);
    return i < workflow.length - 1 ? workflow[i + 1] : null;
  }
}
