import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../models/booking.dart';
import '../widgets/common.dart';
import '../widgets/order_card.dart';
import 'order_detail_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, required this.onBook});
  final VoidCallback onBook;
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  String filter = 'All';
  String search = '';
  @override
  Widget build(BuildContext context) {
    final orders = AppScope.of(context).bookings.where((b) {
      final matchesFilter =
          filter == 'All' ||
          (filter == 'Active' && !b.isClosed) ||
          (filter == 'Completed' && b.status == OrderStatus.delivered) ||
          (filter == 'Cancelled' && b.status == OrderStatus.cancelled);
      return matchesFilter &&
          '${b.trackingId} ${b.draft.service.name} ${b.draft.branch.name}'
              .toLowerCase()
              .contains(search.toLowerCase());
    }).toList();
    return SafeArea(
      child: ContentWidth(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 10),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'My Orders',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 6),
                    const Text('Your active bookings and laundry history.'),
                    const SizedBox(height: 20),
                    TextField(
                      onChanged: (v) => setState(() => search = v),
                      decoration: const InputDecoration(
                        hintText: 'Search order, service or branch',
                        prefixIcon: Icon(Icons.search),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      children: ['All', 'Active', 'Completed', 'Cancelled']
                          .map(
                            (label) => ChoiceChip(
                              label: Text(label),
                              selected: filter == label,
                              onSelected: (_) => setState(() => filter = label),
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${orders.length} order${orders.length == 1 ? '' : 's'}',
                    ),
                  ],
                ),
              ),
            ),
            if (orders.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: EmptyState(
                    title: 'No orders here yet',
                    message: 'Create a booking or try a different filter.',
                    action: FilledButton(
                      onPressed: widget.onBook,
                      child: const Text('Create Booking'),
                    ),
                  ),
                ),
              ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 90),
              sliver: SliverList.builder(
                itemCount: orders.length,
                itemBuilder: (context, i) => OrderCard(
                  booking: orders[i],
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          OrderDetailScreen(id: orders[i].trackingId),
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
