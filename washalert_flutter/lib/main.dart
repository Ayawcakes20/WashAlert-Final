import 'package:flutter/material.dart';
import 'data/app_state.dart';
import 'screens/splash_screen.dart';
import 'theme/app_theme.dart';

void main() => runApp(const WashAlertApp());

class WashAlertApp extends StatefulWidget {
  const WashAlertApp({super.key});
  @override
  State<WashAlertApp> createState() => _WashAlertAppState();
}

class _WashAlertAppState extends State<WashAlertApp> {
  final AppState state = AppState();
  @override
  void dispose() {
    state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppScope(
    state: state,
    child: MaterialApp(
      title: 'WashAlert',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const SplashScreen(),
    ),
  );
}
