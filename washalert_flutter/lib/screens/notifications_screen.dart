import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../widgets/common.dart';
import 'order_detail_screen.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final updates =
        AppScope.of(context).bookings
            .expand((b) => b.events.map((e) => (booking: b, event: e)))
            .toList()
          ..sort((a, b) => b.event.at.compareTo(a.event.at));
    return SafeArea(
      child: ContentWidth(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Your Updates',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            const Text('Local booking activity for this session.'),
            const SizedBox(height: 20),
            if (updates.isEmpty)
              const EmptyState(
                title: 'You are all caught up',
                message: 'Booking and progress updates will appear here.',
              ),
            for (final update in updates)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Surface(
                  padding: EdgeInsets.zero,
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    leading: const Icon(Icons.local_laundry_service_outlined),
                    title: Text(
                      update.event.status.label(update.booking.draft.mode),
                    ),
                    subtitle: Text(
                      '${update.booking.trackingId}\n${dateLabel(update.event.at)} / ${timeLabel(update.event.at)}',
                    ),
                    isThreeLine: true,
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            OrderDetailScreen(id: update.booking.trackingId),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
