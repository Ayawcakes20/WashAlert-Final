import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../models/booking.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.id});
  final String id;
  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  bool processing = false;
  final scroll = ScrollController();

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  Future<void> pay() async {
    if (processing) return;
    final state = AppScope.of(context);
    setState(() => processing = true);
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;
    try {
      state.pay(widget.id);
    } on StateError catch (e) {
      showMessage(context, e.message);
    }
    if (mounted) setState(() => processing = false);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && scroll.hasClients) scroll.jumpTo(0);
    });
  }

  @override
  Widget build(BuildContext context) {
    final b = AppScope.of(context).findBooking(widget.id);
    if (b == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Payment')),
        body: const EmptyState(
          title: 'Order unavailable',
          message: 'Return to My Orders.',
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Payment Simulation')),
      body: ContentWidth(
        child: ListView(
          controller: scroll,
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 20),
            CircleAvatar(
              radius: 45,
              backgroundColor: b.isPaid
                  ? AppTheme.mint
                  : const Color(0xFFD6EAF8),
              child: Icon(
                b.isPaid
                    ? Icons.check_circle_outline
                    : Icons.account_balance_wallet_outlined,
                size: 44,
                color: b.isPaid ? AppTheme.green : AppTheme.blue,
              ),
            ),
            const SizedBox(height: 22),
            Text(
              b.isPaid ? 'Payment Confirmed' : b.draft.paymentLabel,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 12),
            Text(
              money(b.total),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(b.trackingId, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            const InfoBanner(
              'School prototype: no payment gateway, QR transaction or real cash collection is connected.',
            ),
            const SizedBox(height: 22),
            if (b.isPaid) ...[
              Surface(
                child: Column(
                  children: [
                    DetailRow('Status', 'Paid (simulation)'),
                    DetailRow(
                      'Reference',
                      b.paymentReference ?? 'Not available',
                    ),
                    if (b.paidAt != null)
                      DetailRow(
                        'Confirmed at',
                        '${dateLabel(b.paidAt!)} / ${timeLabel(b.paidAt!)}',
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Back to Order'),
              ),
            ] else ...[
              PriceSummary(draft: b.draft, booking: b),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: processing || b.finalPrice == null || b.isClosed
                    ? null
                    : pay,
                icon: Icon(processing ? Icons.hourglass_empty : Icons.check),
                label: Text(
                  processing
                      ? 'Confirming...'
                      : b.draft.paymentMethod == PaymentMethod.gcash
                      ? 'Simulate Successful GCash Payment'
                      : 'Confirm Demo Cash Collected',
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: processing ? null : () => Navigator.pop(context),
                child: const Text('Not now / Return to Order'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
