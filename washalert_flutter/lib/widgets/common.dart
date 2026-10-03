import 'package:flutter/material.dart';
import '../models/booking.dart';
import '../theme/app_theme.dart';

String money(num value) => 'PHP ${value.toStringAsFixed(2)}';
String dateLabel(DateTime date) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}

String timeLabel(DateTime date) =>
    '${date.hour % 12 == 0 ? 12 : date.hour % 12}:${date.minute.toString().padLeft(2, '0')} ${date.hour < 12 ? 'AM' : 'PM'}';

void showMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context).hideCurrentSnackBar();
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
  );
}

void runAction(BuildContext context, VoidCallback action, {String? success}) {
  try {
    action();
    if (success != null) showMessage(context, success);
  } on StateError catch (error) {
    showMessage(context, error.message);
  }
}

Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  required String confirm,
}) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep booking'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(confirm),
          ),
        ],
      ),
    ) ??
    false;

class ContentWidth extends StatelessWidget {
  const ContentWidth({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    heightFactor: 1,
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 640),
      child: child,
    ),
  );
}

class Section extends StatelessWidget {
  const Section({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
  });
  final String title;
  final String? subtitle;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        if (subtitle != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              subtitle!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        const SizedBox(height: 12),
        child,
      ],
    ),
  );
}

class Surface extends StatelessWidget {
  const Surface({
    super.key,
    required this.child,
    this.color = Colors.white,
    this.padding = const EdgeInsets.all(20),
  });
  final Widget child;
  final Color color;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Material(
    color: color,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(22),
      side: const BorderSide(color: AppTheme.border),
    ),
    clipBehavior: Clip.antiAlias,
    child: SizedBox(
      width: double.infinity,
      child: Padding(padding: padding, child: child),
    ),
  );
}

class InfoBanner extends StatelessWidget {
  const InfoBanner(
    this.text, {
    super.key,
    this.icon = Icons.info_outline,
    this.color = AppTheme.mint,
  });
  final String text;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Surface(
    color: color,
    padding: const EdgeInsets.all(16),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 22, color: AppTheme.navy),
        const SizedBox(width: 12),
        Expanded(child: Text(text)),
      ],
    ),
  );
}

class DetailRow extends StatelessWidget {
  const DetailRow(this.label, this.value, {super.key, this.bold = false});
  final String label;
  final String value;
  final bool bold;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 4,
          child: Text(label, style: const TextStyle(color: AppTheme.muted)),
        ),
        const SizedBox(width: 16),
        Expanded(
          flex: 5,
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.booking, {super.key});
  final Booking booking;
  @override
  Widget build(BuildContext context) {
    final cancelled = booking.status == OrderStatus.cancelled;
    final pending =
        booking.status == OrderStatus.pending ||
        booking.status == OrderStatus.awaitingPriceConfirmation;
    final bg = cancelled
        ? const Color(0xFFFEE2E2)
        : pending
        ? const Color(0xFFFEF3C7)
        : AppTheme.mint;
    final fg = cancelled
        ? const Color(0xFF991B1B)
        : pending
        ? const Color(0xFF92400E)
        : AppTheme.green;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        booking.statusLabel,
        style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class PriceSummary extends StatelessWidget {
  const PriceSummary({super.key, required this.draft, this.booking});
  final BookingDraft draft;
  final Booking? booking;
  @override
  Widget build(BuildContext context) {
    final price = booking?.breakdown ?? PriceBreakdown(draft);
    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            booking?.finalPrice != null
                ? 'Final Receipt'
                : 'Estimated Price Breakdown',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          DetailRow('Service fee', money(price.service)),
          DetailRow(
            booking?.actualKg != null
                ? 'Verified actual weight'
                : 'Estimated weight',
            '${booking?.actualKg ?? draft.estimatedKg} kg',
          ),
          DetailRow(
            'Load count',
            '${draft.service.loadsFor(booking?.actualKg ?? draft.estimatedKg)}',
          ),
          DetailRow(
            'Detergent',
            draft.detergent == null
                ? 'Customer Provided (no fee)'
                : '${draft.detergent!.name} x ${draft.detergentQty}',
          ),
          if (price.detergent > 0)
            DetailRow('Detergent cost', money(price.detergent)),
          DetailRow(
            'Fabric conditioner',
            draft.conditioner == null
                ? 'Customer Provided (no fee)'
                : '${draft.conditioner!.name} x ${draft.conditionerQty}',
          ),
          if (price.conditioner > 0)
            DetailRow('Conditioner cost', money(price.conditioner)),
          if (price.extraWeight > 0)
            DetailRow('Additional weight', money(price.extraWeight)),
          if (draft.rush) DetailRow('Rush fee', money(price.rush)),
          DetailRow(
            'Pickup / delivery${booking?.finalPrice == null ? ' (estimate)' : ''}',
            money(price.delivery),
          ),
          const Divider(),
          DetailRow(
            booking?.finalPrice != null ? 'Final total' : 'Estimated total',
            money(booking?.total ?? price.total),
            bold: true,
          ),
          if (booking != null) ...[
            DetailRow('Payment method', draft.paymentLabel),
            DetailRow(
              'Payment status',
              booking!.isPaid ? 'Paid (simulation)' : 'Pending',
            ),
            if (booking!.paymentReference != null)
              DetailRow('Demo reference', booking!.paymentReference!),
          ],
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.message,
    this.action,
  });
  final String title;
  final String message;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(28),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.local_laundry_service_outlined,
          size: 64,
          color: AppTheme.blue,
        ),
        const SizedBox(height: 18),
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppTheme.muted),
        ),
        if (action != null) ...[const SizedBox(height: 20), action!],
      ],
    ),
  );
}
