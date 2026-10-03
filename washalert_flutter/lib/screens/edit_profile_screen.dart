import 'package:flutter/material.dart';
import '../data/app_state.dart';
import '../widgets/common.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final phone = TextEditingController();
  final address = TextEditingController();
  bool initialized = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (initialized) return;
    final user = AppScope.of(context).customer!;
    name.text = user.fullName;
    phone.text = user.phone;
    address.text = user.address;
    initialized = true;
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Edit Profile')),
    body: ContentWidth(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Keep your contact information up to date.'),
              const SizedBox(height: 24),
              TextFormField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Full name'),
                validator: (v) =>
                    (v ?? '').trim().split(RegExp(r'\s+')).length < 2
                    ? 'Enter your first and last name.'
                    : null,
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Mobile number'),
                validator: (v) =>
                    !RegExp(r'^09\d{9}$').hasMatch((v ?? '').trim())
                    ? 'Use 09XXXXXXXXX.'
                    : null,
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: address,
                keyboardType: TextInputType.streetAddress,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Address'),
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? 'Enter your address.' : null,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () {
                  if (!form.currentState!.validate()) return;
                  AppScope.of(
                    context,
                  ).updateProfile(name.text, phone.text, address.text);
                  showMessage(
                    context,
                    'Profile updated. New bookings use your updated details.',
                  );
                  Navigator.pop(context);
                },
                child: const Text('Save Profile'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
