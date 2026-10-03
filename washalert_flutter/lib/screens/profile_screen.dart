import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../models/booking.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'auth_screen.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final user = state.customer;
    if (user == null) return const SizedBox.shrink();
    final completed = state.bookings
        .where((b) => b.status == OrderStatus.delivered)
        .length;
    return SafeArea(
      child: ContentWidth(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              'My Profile',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 24),
            Surface(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 42,
                    backgroundColor: AppTheme.mint,
                    foregroundColor: AppTheme.navy,
                    child: Text(
                      user.initials,
                      style: const TextStyle(
                        fontSize: 27,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    user.fullName,
                    style: Theme.of(context).textTheme.titleLarge,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    user.email,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppTheme.muted),
                  ),
                  const SizedBox(height: 12),
                  const Chip(label: Text('CUSTOMER')),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Section(
              title: 'Personal Information',
              child: Surface(
                child: Column(
                  children: [
                    DetailRow('Mobile number', user.phone),
                    DetailRow('Address', user.address),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute<void>(
                            builder: (_) => const EditProfileScreen(),
                          ),
                        ),
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Edit Profile'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Section(
              title: 'Activity',
              child: Surface(
                child: Column(
                  children: [
                    DetailRow(
                      'Active bookings',
                      '${state.bookings.where((b) => !b.isClosed).length}',
                    ),
                    DetailRow('Completed orders', '$completed'),
                  ],
                ),
              ),
            ),
            const InfoBanner(
              'All details are stored in memory for this session. Restarting the app clears local accounts and bookings.',
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () async {
                final logout = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Sign Out?'),
                    content: const Text(
                      'Bookings remain in memory until the app restarts. You can sign in again during this session.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Stay signed in'),
                      ),
                      FilledButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Sign Out'),
                      ),
                    ],
                  ),
                );
                if (!context.mounted || logout != true) return;
                state.logout();
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute<void>(builder: (_) => const AuthScreen()),
                  (_) => false,
                );
              },
              icon: const Icon(Icons.logout),
              label: const Text('Sign Out'),
            ),
          ],
        ),
      ),
    );
  }
}
