class Customer {
  Customer({
    required this.id,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.address,
  });
  final int id;
  String fullName;
  final String email;
  String phone;
  String address;
  String get initials => fullName
      .trim()
      .split(RegExp(r'\s+'))
      .take(2)
      .map((word) => word.isEmpty ? '' : word[0])
      .join()
      .toUpperCase();
}
