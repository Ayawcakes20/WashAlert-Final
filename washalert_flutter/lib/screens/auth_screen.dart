import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import 'customer_shell.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final address = TextEditingController();
  final password = TextEditingController();
  final confirm = TextEditingController();
  bool register = false;
  bool showPassword = false;
  bool showConfirm = false;
  bool agreed = false;
  bool submitting = false;
  String? error;

  @override
  void dispose() {
    for (final c in [name, email, phone, address, password, confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  void openHome() => Navigator.of(context).pushReplacement(
    MaterialPageRoute<void>(builder: (_) => const CustomerShell()),
  );
  void submit() {
    if (submitting || !form.currentState!.validate()) return;
    if (register && !agreed) {
      setState(
        () => error = 'Please agree to the prototype terms to continue.',
      );
      return;
    }
    setState(() {
      submitting = true;
      error = null;
    });
    try {
      final state = AppScope.of(context);
      if (register) {
        state.register(
          fullName: name.text,
          email: email.text,
          phone: phone.text,
          address: address.text,
          password: password.text,
        );
      } else {
        state.login(email.text, password.text);
      }
      openHome();
    } on StateError catch (e) {
      setState(() {
        error = e.message;
        submitting = false;
      });
    }
  }

  Widget field(
    String label,
    TextEditingController controller, {
    TextInputType? keyboard,
    String? Function(String?)? validator,
    bool obscure = false,
    VoidCallback? toggle,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      controller: controller,
      keyboardType: keyboard,
      obscureText: obscure,
      textInputAction: TextInputAction.next,
      validator:
          validator ??
          (v) => v == null || v.trim().isEmpty ? '$label is required.' : null,
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: toggle == null
            ? null
            : IconButton(
                onPressed: toggle,
                tooltip: obscure ? 'Show password' : 'Hide password',
                icon: Icon(
                  obscure
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
              ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: ContentWidth(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 22),
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: Image.asset(
                      'assets/images/icon.png',
                      width: 82,
                      height: 82,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'WashAlert',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const Text(
                  'Your Laundry, Our Priority',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.muted),
                ),
                const SizedBox(height: 28),
                Text(
                  register ? 'Create your account' : 'Welcome back',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  register
                      ? 'Book and track your laundry in one place.'
                      : 'Sign in to your account to continue.',
                  style: const TextStyle(color: AppTheme.muted),
                ),
                const SizedBox(height: 22),
                if (register)
                  field(
                    'Full name',
                    name,
                    validator: (v) =>
                        (v ?? '').trim().split(RegExp(r'\s+')).length < 2
                        ? 'Enter your first and last name.'
                        : null,
                  ),
                field(
                  'Email address',
                  email,
                  keyboard: TextInputType.emailAddress,
                  validator: (v) =>
                      !RegExp(
                        r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                      ).hasMatch((v ?? '').trim())
                      ? 'Enter a valid email address.'
                      : null,
                ),
                if (register) ...[
                  field(
                    'Mobile number',
                    phone,
                    keyboard: TextInputType.phone,
                    validator: (v) =>
                        !RegExp(r'^09\d{9}$').hasMatch((v ?? '').trim())
                        ? 'Use 09XXXXXXXXX.'
                        : null,
                  ),
                  field(
                    'Address',
                    address,
                    keyboard: TextInputType.streetAddress,
                  ),
                ],
                field(
                  'Password',
                  password,
                  obscure: !showPassword,
                  toggle: () => setState(() => showPassword = !showPassword),
                  validator: (v) {
                    if ((v ?? '').length < 8) {
                      return 'Use at least 8 characters.';
                    }
                    if (register &&
                        !RegExp(r'(?=.*[a-zA-Z])(?=.*\d)').hasMatch(v!)) {
                      return 'Include a letter and a number.';
                    }
                    return null;
                  },
                ),
                if (register) ...[
                  field(
                    'Confirm password',
                    confirm,
                    obscure: !showConfirm,
                    toggle: () => setState(() => showConfirm = !showConfirm),
                    validator: (v) =>
                        v != password.text ? 'Passwords do not match.' : null,
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: agreed,
                    onChanged: (v) => setState(() => agreed = v ?? false),
                    controlAffinity: ListTileControlAffinity.leading,
                    title: const Text(
                      'I understand this is a local school prototype.',
                    ),
                    subtitle: const Text(
                      'Use sample details and a password you do not use elsewhere.',
                    ),
                  ),
                ],
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: InfoBanner(error!, color: const Color(0xFFFEE2E2)),
                  ),
                FilledButton(
                  onPressed: submitting ? null : submit,
                  child: Text(register ? 'Create Account' : 'Sign In'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(() {
                    register = !register;
                    error = null;
                    form.currentState?.reset();
                  }),
                  child: Text(
                    register
                        ? 'Already have an account? Sign in'
                        : 'New to WashAlert? Create an account',
                  ),
                ),
                if (!register) ...[
                  const Divider(),
                  OutlinedButton.icon(
                    onPressed: () {
                      AppScope.of(
                        context,
                      ).login(AppState.demoEmail, AppState.demoPassword);
                      openHome();
                    },
                    icon: const Icon(Icons.play_circle_outline),
                    label: const Text('Try the demo account'),
                  ),
                ],
                const SizedBox(height: 18),
                const Text(
                  'Offline simulation. Accounts and bookings last only for this app session.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.muted, fontSize: 13),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
