import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../models/booking.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class TrackingScreen extends StatelessWidget {
  const TrackingScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context) {
    final b = AppScope.of(context).findBooking(id);
    if (b == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Track Order')),
        body: const EmptyState(
          title: 'Order unavailable',
          message: 'Choose an existing booking from My Orders.',
        ),
      );
    }
    final progress = b.workflow.indexOf(b.status);
    return Scaffold(
      appBar: AppBar(title: const Text('Track Order')),
      body: ContentWidth(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(id, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            StatusBadge(b),
            const SizedBox(height: 20),
            InfoBanner(
              b.status == OrderStatus.cancelled
                  ? 'This booking has been cancelled.'
                  : b.status == OrderStatus.delivered
                  ? 'Your laundry has been handed over. Thank you for choosing WashAlert.'
                  : 'Local progress simulation. Advance this order from Presentation Controls in Order Details.',
            ),
            const SizedBox(height: 20),
            if (b.draft.mode == ServiceMode.delivery) ...[
              const Surface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.route_outlined, size: 36, color: AppTheme.blue),
                    SizedBox(height: 12),
                    Text(
                      'Delivery tracking',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'No live driver or GPS is connected. This prototype demonstrates pickup and delivery status updates only.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
            Section(
              title: 'Washing & Delivery Progress',
              child: Surface(
                child: Column(
                  children: [
                    for (var i = 0; i < b.workflow.length; i++)
                      Builder(
                        builder: (context) {
                          final status = b.workflow[i];
                          final reached = b.events.any(
                            (e) => e.status == status,
                          );
                          final active = b.status == status;
                          StatusEvent? event;
                          for (final e in b.events) {
                            if (e.status == status) event = e;
                          }
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: reached
                                        ? AppTheme.mint
                                        : AppTheme.background,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    reached
                                        ? Icons.check
                                        : Icons.circle_outlined,
                                    size: 20,
                                    color: reached
                                        ? AppTheme.green
                                        : AppTheme.muted,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        status.label(b.draft.mode),
                                        style: TextStyle(
                                          fontWeight: active
                                              ? FontWeight.w800
                                              : FontWeight.w500,
                                          color: reached
                                              ? AppTheme.ink
                                              : AppTheme.muted,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        event == null
                                            ? 'Upcoming'
                                            : '${dateLabel(event.at)} / ${timeLabel(event.at)}',
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: AppTheme.muted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (active)
                                  const Icon(
                                    Icons.radio_button_checked,
                                    color: AppTheme.blue,
                                    size: 20,
                                  ),
                              ],
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
            if (progress >= 0 && !b.isClosed)
              LinearProgressIndicator(
                value: (progress + 1) / b.workflow.length,
                minHeight: 6,
              ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
