import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../models/booking.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'booking_screen.dart';
import 'payment_screen.dart';
import 'tracking_screen.dart';

class OrderDetailScreen extends StatelessWidget {
  const OrderDetailScreen({super.key, required this.id});
  final String id;

  Future<void> remove(
    BuildContext context,
    AppState state, {
    required bool cancel,
  }) async {
    final accepted = await confirmAction(
      context,
      title: cancel ? 'Cancel Booking?' : 'Remove Booking?',
      message: cancel
          ? 'This booking will move to your Cancelled history.'
          : 'This removes the booking and its local updates from this session.',
      confirm: cancel ? 'Cancel booking' : 'Remove',
    );
    if (!context.mounted || !accepted) return;
    try {
      if (cancel) {
        state.cancelBooking(id);
        showMessage(context, 'Booking cancelled.');
      } else {
        state.removeBooking(id);
        showMessage(context, 'Booking removed.');
        Navigator.pop(context);
      }
    } on StateError catch (e) {
      showMessage(context, e.message);
    }
  }

  Future<void> verifyWeight(
    BuildContext context,
    AppState state,
    Booking b,
  ) async {
    final controller = TextEditingController(
      text: '${b.actualKg ?? b.draft.estimatedKg}',
    );
    final key = GlobalKey<FormState>();
    final weight = await showDialog<double>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Demo: Verify Actual Weight'),
        content: Form(
          key: key,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Simulate the branch weighing your laundry. The final receipt is recalculated locally.',
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: controller,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Actual weight (kg)',
                ),
                validator: (v) {
                  final kg = double.tryParse(v ?? '');
                  return kg == null || !kg.isFinite || kg < 5 || kg > 9
                      ? 'Enter 5 to 9 kg.'
                      : null;
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: () {
              if (key.currentState!.validate()) {
                Navigator.pop(dialogContext, double.parse(controller.text));
              }
            },
            child: const Text('Set Final Price'),
          ),
        ],
      ),
    );
    // Dialog transitions finish before releasing its text controller.
    await Future<void>.delayed(const Duration(milliseconds: 250));
    controller.dispose();
    if (context.mounted && weight != null) {
      runAction(
        context,
        () => state.finalizePrice(id, weight),
        success: 'Weight verified. Final receipt updated.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final b = state.findBooking(id);
    if (b == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Order Details')),
        body: const EmptyState(
          title: 'Order unavailable',
          message:
              'This booking was removed or belongs to another local account.',
        ),
      );
    }
    final d = b.draft;
    return Scaffold(
      appBar: AppBar(title: const Text('Order Details')),
      body: ContentWidth(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.navy,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    id,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    money(b.total),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    b.finalPrice == null
                        ? 'Estimated total / subject to branch verification'
                        : 'Branch-confirmed final total (simulation)',
                    style: const TextStyle(color: Colors.white70),
                  ),
                  const SizedBox(height: 18),
                  StatusBadge(b),
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (!b.isClosed) ...[
              OutlinedButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => TrackingScreen(id: id),
                  ),
                ),
                icon: const Icon(Icons.timeline),
                label: const Text('Track Order'),
              ),
              const SizedBox(height: 20),
            ],
            Section(
              title: 'Laundry Services Details',
              child: Surface(
                child: Column(
                  children: [
                    DetailRow('Laundry service', d.service.name),
                    DetailRow('Delivery service', d.modeLabel),
                    DetailRow('Branch', d.branch.name),
                    DetailRow('Booking date', dateLabel(d.date)),
                    DetailRow('Time window', d.slot),
                    DetailRow('Estimated weight', '${d.estimatedKg} kg'),
                    if (b.actualKg != null)
                      DetailRow('Verified actual weight', '${b.actualKg} kg'),
                    DetailRow(
                      'Instructions',
                      d.instructions.trim().isEmpty
                          ? 'No special instructions'
                          : d.instructions,
                    ),
                  ],
                ),
              ),
            ),
            Section(
              title: d.mode == ServiceMode.delivery
                  ? 'Pickup & Delivery Information'
                  : 'Branch Collection',
              child: Surface(
                child: Column(
                  children: [
                    if (d.mode == ServiceMode.delivery) ...[
                      DetailRow('Address', d.address),
                      if (d.unitFloor.isNotEmpty)
                        DetailRow('Unit / Landmark', d.unitFloor),
                      DetailRow('Contact name', d.contactName),
                      DetailRow('Contact number', d.contactPhone),
                    ] else
                      DetailRow('Collect at', d.branch.address),
                    if (d.mode == ServiceMode.delivery)
                      const DetailRow(
                        'Rider',
                        'No live rider assigned in this prototype',
                      ),
                  ],
                ),
              ),
            ),
            PriceSummary(draft: d, booking: b),
            const SizedBox(height: 14),
            const Text(
              'Question about the price? Contact the branch.',
              style: TextStyle(color: AppTheme.muted),
            ),
            const SizedBox(height: 18),
            if (b.status == OrderStatus.awaitingPriceConfirmation) ...[
              FilledButton.icon(
                onPressed: () => runAction(
                  context,
                  () => state.advanceStatus(id),
                  success: 'Final price confirmed.',
                ),
                icon: const Icon(Icons.check_circle_outline),
                label: const Text('Confirm Final Price'),
              ),
              const SizedBox(height: 12),
            ],
            if (b.isPaid)
              const InfoBanner(
                'Payment confirmed in this simulation. No real money was charged.',
                icon: Icons.check_circle_outline,
              )
            else if (!b.isClosed) ...[
              FilledButton.icon(
                onPressed: b.finalPrice == null
                    ? null
                    : () => Navigator.push(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) => PaymentScreen(id: id),
                        ),
                      ),
                icon: Icon(
                  d.paymentMethod == PaymentMethod.gcash
                      ? Icons.account_balance_wallet_outlined
                      : Icons.payments_outlined,
                ),
                label: Text(
                  d.paymentMethod == PaymentMethod.gcash
                      ? 'Pay via GCash (Demo)'
                      : 'Simulate Cash Collection',
                ),
              ),
              if (b.finalPrice == null)
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Text(
                    'Payment opens after the branch verifies your final price.',
                    style: TextStyle(color: AppTheme.muted),
                  ),
                ),
            ],
            const SizedBox(height: 24),
            if (b.isPending && !b.isPaid) ...[
              Section(
                title: 'Manage Booking',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) => BookingScreen(editId: id),
                        ),
                      ),
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Edit Pending Booking'),
                    ),
                    const SizedBox(height: 10),
                    TextButton(
                      onPressed: () => remove(context, state, cancel: true),
                      child: const Text(
                        'Cancel Booking',
                        style: TextStyle(color: Color(0xFFB91C1C)),
                      ),
                    ),
                    TextButton(
                      onPressed: () => remove(context, state, cancel: false),
                      child: const Text(
                        'Remove Pending Booking',
                        style: TextStyle(color: AppTheme.muted),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (b.status == OrderStatus.cancelled)
              TextButton.icon(
                onPressed: () => remove(context, state, cancel: false),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Remove from local history'),
              ),
            Surface(
              color: const Color(0xFFE8EFF4),
              padding: EdgeInsets.zero,
              child: ExpansionTile(
                title: const Text(
                  'Presentation Controls',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: const Text(
                  'Demo only: simulate staff and rider actions',
                ),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                children: [
                  const Text(
                    'Advance one step at a time. No backend, driver GPS or live payment is connected.',
                  ),
                  const SizedBox(height: 14),
                  if (b.status == OrderStatus.awaitingPriceConfirmation &&
                      !b.isPaid) ...[
                    OutlinedButton.icon(
                      onPressed: () => verifyWeight(context, state, b),
                      icon: const Icon(Icons.scale_outlined),
                      label: const Text('Verify Weight / Final Price'),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (b.nextStatus != null)
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => runAction(
                          context,
                          () => state.advanceStatus(id),
                          success: 'Order progress updated.',
                        ),
                        icon: const Icon(Icons.skip_next_outlined),
                        label: Text('Next: ${b.nextStatus!.label(d.mode)}'),
                      ),
                    )
                  else
                    Text(
                      b.status == OrderStatus.cancelled
                          ? 'This booking was cancelled.'
                          : 'This order is complete.',
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
