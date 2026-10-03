import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../theme/app_theme.dart';
import 'booking_screen.dart';
import 'home_screen.dart';
import 'orders_screen.dart';
import 'profile_screen.dart';
import 'notifications_screen.dart';

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});
  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int index = 0;
  Future<void> book() async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const BookingScreen()));
    if (mounted) setState(() => index = 1);
  }

  @override
  Widget build(BuildContext context) {
    AppScope.of(context);
    return Scaffold(
      body: IndexedStack(
        index: index,
        children: [
          HomeScreen(onBook: book, onOrders: () => setState(() => index = 1)),
          OrdersScreen(onBook: book),
          const NotificationsScreen(),
          const ProfileScreen(),
        ],
      ),
      floatingActionButton: index < 2
          ? FloatingActionButton(
              backgroundColor: AppTheme.navy,
              foregroundColor: Colors.white,
              onPressed: book,
              tooltip: 'Book laundry',
              child: const Icon(Icons.add),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (v) => setState(() => index = v),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Orders',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_outlined),
            selectedIcon: Icon(Icons.notifications),
            label: 'Updates',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
