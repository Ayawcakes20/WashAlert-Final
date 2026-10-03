import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../data/catalog.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import '../widgets/order_card.dart';
import 'booking_screen.dart';
import 'order_detail_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.onBook, required this.onOrders});
  final VoidCallback onBook;
  final VoidCallback onOrders;
  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final active = state.bookings.where((b) => !b.isClosed).take(3).toList();
    return SafeArea(
      child: ContentWidth(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 90),
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.asset(
                    'assets/images/icon.png',
                    width: 42,
                    height: 42,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'WashAlert',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                const SizedBox(width: 8),
                const Chip(label: Text('Offline demo')),
              ],
            ),
            const SizedBox(height: 22),
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(26),
                gradient: const LinearGradient(
                  colors: [AppTheme.navy, Color(0xFF2E4A60)],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Hello, ${state.customer?.fullName.split(' ').first ?? 'Customer'}',
                    style: const TextStyle(fontSize: 16, color: Colors.white70),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Fresh laundry.\nOne less thing to do.',
                    style: TextStyle(
                      fontSize: 29,
                      height: 1.15,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Choose a service. We will take care of the rest.',
                    style: TextStyle(color: Colors.white70),
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: onBook,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.mint,
                      foregroundColor: AppTheme.navy,
                    ),
                    icon: const Icon(Icons.local_laundry_service_outlined),
                    label: const Text('Book Laundry'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 26),
            Section(
              title: 'Laundry Services',
              subtitle: 'Choose a package to start your booking.',
              child: SizedBox(
                height: 232,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: Catalog.services.length,
                  separatorBuilder: (_, index) => const SizedBox(width: 12),
                  itemBuilder: (context, i) {
                    final service = Catalog.services[i];
                    return SizedBox(
                      width: 168,
                      child: Material(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) =>
                                  BookingScreen(initialService: service),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Image.asset(
                                'assets/images/${service.image}',
                                height: 116,
                                width: 168,
                                fit: BoxFit.cover,
                              ),
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      service.name,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      '${money(service.basePrice)} / ${service.perKg ? 'kg' : '${service.capacityKg} kg'}',
                                      style: const TextStyle(
                                        color: AppTheme.blue,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Active Orders',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                TextButton(onPressed: onOrders, child: const Text('View all')),
              ],
            ),
            if (active.isEmpty)
              const Surface(
                child: EmptyState(
                  title: 'Your laundry starts here',
                  message: 'Create your first booking to see its progress.',
                ),
              ),
            for (final b in active)
              OrderCard(
                booking: b,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => OrderDetailScreen(id: b.trackingId),
                  ),
                ),
              ),
            const SizedBox(height: 24),
            const Section(
              title: 'Our Branches',
              child: InfoBanner(
                'Triplets LaundryHubs and SpeedyWash. Select your preferred branch during booking.',
                icon: Icons.storefront_outlined,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
