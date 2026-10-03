class Supply {
  const Supply(this.id, this.name, this.unitPrice);
  final String id;
  final String name;
  final double unitPrice;
}

class Branch {
  const Branch(this.name, this.address);
  final String name;
  final String address;
}

class LaundryService {
  const LaundryService({
    required this.id,
    required this.name,
    required this.description,
    required this.basePrice,
    required this.capacityKg,
    required this.image,
    this.largePrice,
    this.perKg = false,
    this.dryOnly = false,
  });
  final String id;
  final String name;
  final String description;
  final double basePrice;
  final double? largePrice;
  final int capacityKg;
  final String image;
  final bool perKg;
  final bool dryOnly;
  double priceFor(double kg) => perKg
      ? kg * (kg <= 3 ? 150 : 90)
      : (kg > 7 ? largePrice ?? basePrice : basePrice);
  int loadsFor(double kg) => (kg / capacityKg).ceil().clamp(1, 99);
}
