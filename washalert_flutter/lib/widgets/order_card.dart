import 'package:flutter/material.dart';
import '../models/booking.dart';
import '../theme/app_theme.dart';
import 'common.dart';

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.booking, required this.onTap});
  final Booking booking;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      booking.trackingId,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: AppTheme.muted),
                ],
              ),
              const SizedBox(height: 12),
              StatusBadge(booking),
              const SizedBox(height: 16),
              Text(
                booking.draft.service.name,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                '${booking.draft.branch.name} / ${booking.draft.modeLabel}',
                style: const TextStyle(color: AppTheme.muted),
              ),
              const SizedBox(height: 6),
              Text(
                '${dateLabel(booking.draft.date)} / ${booking.draft.slot}',
                style: const TextStyle(color: AppTheme.muted),
              ),
              const Divider(),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      booking.isPaid ? 'Paid (simulation)' : 'Payment pending',
                      style: TextStyle(
                        color: booking.isPaid ? AppTheme.green : AppTheme.muted,
                      ),
                    ),
                  ),
                  Text(
                    money(booking.total),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
