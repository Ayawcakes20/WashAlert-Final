import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../data/catalog.dart';
import '../models/booking.dart';
import '../models/catalog_models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'order_detail_screen.dart';

class BookingScreen extends StatefulWidget {
  const BookingScreen({super.key, this.editId, this.initialService});
  final String? editId;
  final LaundryService? initialService;
  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  static const steps = [
    'Package',
    'Location',
    'Extras',
    'Schedule',
    'Payment',
    'Confirm',
  ];
  final form = GlobalKey<FormState>();
  final scroll = ScrollController();
  BookingDraft? value;
  int step = 0;
  bool submitting = false;
  bool agreed = false;
  String? error;
  bool get editing => widget.editId != null;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (value != null) return;
    final state = AppScope.of(context);
    value = editing
        ? state.findBooking(widget.editId!)?.draft.copy()
        : state.newDraft();
    if (widget.initialService != null) value?.service = widget.initialService!;
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  void move(int next) {
    setState(() {
      step = next;
      error = null;
    });
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  void next() {
    if (!form.currentState!.validate()) return;
    if (step == 3 && !Catalog.slotAvailable(value!.date, value!.slot)) {
      setState(() => error = 'Choose an available time slot.');
      return;
    }
    move(step + 1);
  }

  void save() {
    if (submitting || !agreed) return;
    setState(() {
      submitting = true;
      error = null;
    });
    final state = AppScope.of(context);
    try {
      if (editing) {
        state.updateBooking(widget.editId!, value!);
        showMessage(context, 'Booking updated.');
        Navigator.pop(context);
      } else {
        final b = state.createBooking(value!);
        showMessage(context, 'Booking saved. Tracking number: ${b.trackingId}');
        Navigator.pushReplacement(
          context,
          MaterialPageRoute<void>(
            builder: (_) => OrderDetailScreen(id: b.trackingId),
          ),
        );
      }
    } on StateError catch (e) {
      setState(() {
        submitting = false;
        error = e.message;
      });
    }
  }

  Widget input(
    String label,
    String initial,
    ValueChanged<String> changed, {
    bool required = false,
    TextInputType? keyboard,
    int lines = 1,
    String? Function(String?)? validator,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      key: ValueKey('$step-$label'),
      initialValue: initial,
      onChanged: changed,
      maxLines: lines,
      keyboardType: keyboard,
      textInputAction: lines > 1
          ? TextInputAction.newline
          : TextInputAction.next,
      decoration: InputDecoration(labelText: label),
      validator:
          validator ??
          (v) => required && (v ?? '').trim().isEmpty
              ? 'Please enter $label.'
              : null,
    ),
  );

  Widget packageStep(BookingDraft d) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Section(
        title: 'Delivery Services',
        child: Column(
          children: [
            modeTile(
              ServiceMode.delivery,
              'Delivery',
              'We pick up your laundry and deliver it back clean.',
              Icons.local_shipping_outlined,
              d,
            ),
            modeTile(
              ServiceMode.pickUp,
              'Pick Up',
              'Bring your laundry to the branch and collect it when ready.',
              Icons.storefront_outlined,
              d,
            ),
          ],
        ),
      ),
      Section(
        title: 'Laundry Services',
        child: Column(
          children: Catalog.services
              .map(
                (service) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Material(
                    color: d.service == service ? AppTheme.navy : Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () => setState(() {
                        d.service = service;
                        d.normalizeSupplies();
                      }),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: Image.asset(
                                'assets/images/${service.image}',
                                width: 64,
                                height: 64,
                                fit: BoxFit.cover,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    service.name,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: d.service == service
                                          ? Colors.white
                                          : AppTheme.ink,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    service.description,
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: d.service == service
                                          ? Colors.white70
                                          : AppTheme.muted,
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Text(
                                    '${money(service.basePrice)} / ${service.perKg ? 'kg' : '${service.capacityKg} kg'}',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: d.service == service
                                          ? AppTheme.mint
                                          : AppTheme.blue,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Icon(
                              d.service == service
                                  ? Icons.check_circle
                                  : Icons.circle_outlined,
                              color: d.service == service
                                  ? AppTheme.mint
                                  : AppTheme.border,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ),
      Section(
        title: 'Estimated Load Size',
        child: Column(
          children: [
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('Small Load / 5 kg')),
                ButtonSegment(value: true, label: Text('Large Load / 8 kg')),
              ],
              selected: {d.largeLoad},
              onSelectionChanged: (v) => setState(() => d.largeLoad = v.first),
            ),
            const SizedBox(height: 12),
            const InfoBanner(
              'Minimum 5 kg. This is an estimate; the branch will verify the actual weight and final price.',
            ),
          ],
        ),
      ),
    ],
  );

  Widget modeTile(
    ServiceMode mode,
    String title,
    String hint,
    IconData icon,
    BookingDraft d,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Material(
      color: d.mode == mode ? AppTheme.mint : Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: () => setState(() => d.mode = mode),
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Icon(icon, color: AppTheme.navy),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(hint),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(d.mode == mode ? Icons.check_circle : Icons.circle_outlined),
            ],
          ),
        ),
      ),
    ),
  );

  Widget locationStep(BookingDraft d) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Section(
        title: 'Choose a Branch',
        child: DropdownButtonFormField<Branch>(
          initialValue: d.branch,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Branch'),
          items: Catalog.branches
              .map(
                (b) => DropdownMenuItem(
                  value: b,
                  child: Text(b.name, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: (b) => setState(() => d.branch = b!),
        ),
      ),
      Surface(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.storefront_outlined, color: AppTheme.blue),
            const SizedBox(width: 12),
            Expanded(child: Text(d.branch.address)),
          ],
        ),
      ),
      const SizedBox(height: 24),
      if (d.mode == ServiceMode.delivery) ...[
        Section(
          title: 'Pickup & Delivery Address',
          subtitle:
              'Enter the same address fields used by WashAlert. No map service is connected in this prototype.',
          child: Column(
            children: [
              input(
                'Address',
                d.address,
                (v) => d.address = v,
                required: true,
                lines: 2,
                keyboard: TextInputType.streetAddress,
              ),
              input(
                'Unit / Floor / Landmark (optional)',
                d.unitFloor,
                (v) => d.unitFloor = v,
              ),
              input(
                'Contact name',
                d.contactName,
                (v) => d.contactName = v,
                required: true,
              ),
              input(
                'Contact mobile number',
                d.contactPhone,
                (v) => d.contactPhone = v,
                keyboard: TextInputType.phone,
                validator: (v) =>
                    RegExp(r'^09\d{9}$').hasMatch((v ?? '').trim())
                    ? null
                    : 'Use 09XXXXXXXXX.',
              ),
            ],
          ),
        ),
      ] else
        const InfoBanner(
          'Pick Up: bring your laundry to the selected branch. A delivery address and logistics fee are not required.',
        ),
    ],
  );

  Widget supplySelector(BookingDraft d, {required bool detergent}) {
    final selected = detergent ? d.detergent : d.conditioner;
    final options = detergent ? Catalog.detergents : Catalog.conditioners;
    final qty = detergent ? d.detergentQty : d.conditionerQty;
    void select(Supply? supply) => setState(() {
      if (detergent) {
        d.detergent = supply;
        d.detergentQty = supply == null ? 0 : 1;
      } else {
        d.conditioner = supply;
        d.conditionerQty = supply == null ? 0 : 1;
      }
    });
    return Section(
      title: detergent ? 'Detergent' : 'Fabric Conditioner',
      child: Surface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('Customer Provided')),
                ButtonSegment(value: true, label: Text('Shop Provided')),
              ],
              selected: {selected != null},
              onSelectionChanged: (v) => select(v.first ? options.first : null),
            ),
            const SizedBox(height: 16),
            if (selected == null)
              const Text(
                'Bring your own supply. Quantity is 0 and no supply fee is added.',
              )
            else ...[
              DropdownButtonFormField<Supply>(
                key: ValueKey(selected.id),
                initialValue: selected,
                isExpanded: true,
                items: options
                    .map(
                      (s) => DropdownMenuItem(
                        value: s,
                        child: Text(
                          '${s.name} / ${money(s.unitPrice)}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (s) => select(s),
                decoration: const InputDecoration(
                  labelText: 'Laundry Shop Provided',
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Expanded(child: Text('Quantity (packs)')),
                  IconButton(
                    onPressed: qty > 1
                        ? () => setState(() {
                            if (detergent) {
                              d.detergentQty--;
                            } else {
                              d.conditionerQty--;
                            }
                          })
                        : null,
                    tooltip: 'Decrease quantity',
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  Text(
                    '$qty',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  IconButton(
                    onPressed: qty < 10
                        ? () => setState(() {
                            if (detergent) {
                              d.detergentQty++;
                            } else {
                              d.conditionerQty++;
                            }
                          })
                        : null,
                    tooltip: 'Increase quantity',
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget extrasStep(BookingDraft d) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (d.service.dryOnly)
        const Section(
          title: 'Dry Only',
          child: InfoBanner(
            'Detergent and fabric conditioner are disabled for Dry Only. No supply fee is added.',
          ),
        )
      else ...[
        supplySelector(d, detergent: true),
        supplySelector(d, detergent: false),
      ],
      Section(
        title: 'Special Requests',
        child: Surface(
          child: Column(
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Rush Service'),
                subtitle: const Text('Additional PHP 150.00'),
                value: d.rush,
                onChanged: (v) => setState(() => d.rush = v),
              ),
              const SizedBox(height: 12),
              input(
                'Special instructions (optional)',
                d.instructions,
                (v) => d.instructions = v,
                lines: 3,
              ),
            ],
          ),
        ),
      ),
      const Text(
        'Supply quantities and prices are simulated locally. No live inventory is read or changed.',
        style: TextStyle(color: AppTheme.muted),
      ),
    ],
  );

  Widget scheduleStep(BookingDraft d) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Section(
        title: 'Booking Date',
        child: Surface(
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.calendar_month_outlined),
            title: Text(dateLabel(d.date)),
            trailing: const Icon(Icons.edit_calendar_outlined),
            onTap: () async {
              final now = DateUtils.dateOnly(DateTime.now());
              final date = await showDatePicker(
                context: context,
                initialDate: d.date.isBefore(now) ? now : d.date,
                firstDate: now,
                lastDate: now.add(const Duration(days: 14)),
              );
              if (date != null) {
                setState(() {
                  d.date = date;
                  error = null;
                });
              }
            },
          ),
        ),
      ),
      Section(
        title: 'Time Slot',
        subtitle:
            'Past time slots are unavailable. Future dates keep their full schedule.',
        child: Column(
          children: Catalog.slots.map((slot) {
            final available = Catalog.slotAvailable(d.date, slot);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: OutlinedButton(
                onPressed: available
                    ? () => setState(() => d.slot = slot)
                    : null,
                style: OutlinedButton.styleFrom(
                  backgroundColor: available && d.slot == slot
                      ? AppTheme.mint
                      : Colors.white,
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: Row(
                    children: [
                      const Icon(Icons.schedule, size: 20),
                      const SizedBox(width: 12),
                      Expanded(child: Text(slot)),
                      if (!available)
                        const Text(
                          'Unavailable',
                          style: TextStyle(fontSize: 12),
                        )
                      else if (d.slot == slot)
                        const Icon(Icons.check_circle, size: 20),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    ],
  );

  Widget paymentStep(BookingDraft d) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Section(
        title: 'Payment Method',
        subtitle: 'All payments in this app are mock transactions.',
        child: Column(
          children: [
            for (final method in PaymentMethod.values)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Material(
                  color: d.paymentMethod == method
                      ? AppTheme.navy
                      : Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  child: InkWell(
                    onTap: () => setState(() => d.paymentMethod = method),
                    borderRadius: BorderRadius.circular(18),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Row(
                        children: [
                          Icon(
                            method == PaymentMethod.cash
                                ? Icons.payments_outlined
                                : Icons.account_balance_wallet_outlined,
                            color: d.paymentMethod == method
                                ? Colors.white
                                : AppTheme.navy,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  method == PaymentMethod.cash
                                      ? 'Cash on Delivery / Pick Up'
                                      : 'GCash / QRPh',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: d.paymentMethod == method
                                        ? Colors.white
                                        : AppTheme.ink,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  method == PaymentMethod.cash
                                      ? 'Collected when your laundry is released.'
                                      : 'Pay after the branch verifies your final price.',
                                  style: TextStyle(
                                    color: d.paymentMethod == method
                                        ? Colors.white70
                                        : AppTheme.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            d.paymentMethod == method
                                ? Icons.check_circle
                                : Icons.circle_outlined,
                            color: d.paymentMethod == method
                                ? AppTheme.mint
                                : AppTheme.muted,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
      const InfoBanner(
        'No real money is transferred. Booking stays saved while you demonstrate price confirmation and payment.',
      ),
      const SizedBox(height: 20),
      PriceSummary(draft: d),
    ],
  );

  Widget reviewStep(BookingDraft d) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Section(
        title: 'Order Summary',
        child: Surface(
          child: Column(
            children: [
              DetailRow('Delivery Services', d.modeLabel),
              DetailRow('Laundry Services', d.service.name),
              DetailRow('Branch', d.branch.name),
              DetailRow('Schedule', '${dateLabel(d.date)}\n${d.slot}'),
              if (d.mode == ServiceMode.delivery) ...[
                DetailRow('Address', d.address),
                if (d.unitFloor.isNotEmpty)
                  DetailRow('Unit / Landmark', d.unitFloor),
                DetailRow('Contact', '${d.contactName}\n${d.contactPhone}'),
              ],
              DetailRow('Payment method', d.paymentLabel),
              DetailRow(
                'Special instructions',
                d.instructions.trim().isEmpty
                    ? 'No special instructions'
                    : d.instructions,
              ),
            ],
          ),
        ),
      ),
      PriceSummary(draft: d),
      const SizedBox(height: 20),
      const InfoBanner(
        'The branch verifies the actual weight before your final receipt is issued. Delivery uses a PHP 50.00 demo estimate.',
      ),
      const SizedBox(height: 12),
      CheckboxListTile(
        contentPadding: EdgeInsets.zero,
        controlAffinity: ListTileControlAffinity.leading,
        value: agreed,
        onChanged: (v) => setState(() => agreed = v ?? false),
        title: const Text('I reviewed the booking details.'),
        subtitle: const Text(
          'You can edit or cancel an unpaid Pending booking.',
        ),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final d = value;
    if (d == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Booking')),
        body: const EmptyState(
          title: 'Booking unavailable',
          message: 'Return to My Orders and choose an existing booking.',
        ),
      );
    }
    final content = [
      () => packageStep(d),
      () => locationStep(d),
      () => extrasStep(d),
      () => scheduleStep(d),
      () => paymentStep(d),
      () => reviewStep(d),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(editing ? 'Edit Booking' : 'New Booking')),
      body: ContentWidth(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Step ${step + 1} of ${steps.length} / ${steps[step]}',
                    style: const TextStyle(
                      color: AppTheme.blue,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: (step + 1) / steps.length,
                      minHeight: 6,
                      backgroundColor: AppTheme.border,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                controller: scroll,
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                child: Form(
                  key: form,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 180),
                    child: Column(
                      key: ValueKey(step),
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        content[step](),
                        if (error != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 16),
                            child: InfoBanner(
                              error!,
                              color: const Color(0xFFFEE2E2),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: ContentWidth(
          child: Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Row(
              children: [
                if (step > 0) ...[
                  OutlinedButton(
                    onPressed: submitting ? null : () => move(step - 1),
                    child: const Text('Back'),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: FilledButton(
                    onPressed: submitting || (step == 5 && !agreed)
                        ? null
                        : step == 5
                        ? save
                        : next,
                    child: Text(
                      submitting
                          ? 'Saving...'
                          : step == 5
                          ? (editing ? 'Save Changes' : 'Confirm Booking')
                          : 'Continue',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
