import '../models/catalog_models.dart';

// Labels and catalog copied from mobile/src/services/api.js and BookingScreen.jsx.
abstract final class Catalog {
  static const branches = [
    Branch(
      'Makati Branch',
      '7605 Dela Rosa, Corner Wilson St. (inside R&R Carwash), Makati City',
    ),
    Branch(
      'Chestnut Branch',
      '244A Upper Republic Ave., West Fairview Park, Quezon City',
    ),
    Branch('Republic Branch', 'Republic Ave., West Fairview, Quezon City'),
    Branch(
      'Holy Spirit Branch',
      'Faustino St., Brgy. Holy Spirit, Quezon City',
    ),
    Branch('Sta. Catalina Branch', '408 Sta. Catalina St., Quezon City'),
    Branch(
      'Brookside Branch',
      'Sunset Drive, Brookside Hills Subdivision, Cainta, Rizal',
    ),
    Branch('JP Rizal Branch', 'J.P. Rizal Ave., Binangonan, Rizal'),
    Branch('Luzon Branch', 'Luzon Ave., Matandang Balara, Quezon City'),
    Branch('St. Anthony Branch', 'St. Anthony Street, Quezon City'),
    Branch(
      'UP Diliman / San Vicente Branch',
      'San Vicente, Diliman, Quezon City',
    ),
  ];
  static const services = [
    LaundryService(
      id: 'wash',
      name: 'Wash Only',
      description: 'Basic washing service',
      basePrice: 80,
      capacityKg: 7,
      image: 'svc_wash_v3.png',
    ),
    LaundryService(
      id: 'dry',
      name: 'Dry Only',
      description: 'Drying only. No detergent or fabric conditioner needed.',
      basePrice: 90,
      capacityKg: 7,
      image: 'svc_dry_v3.png',
      dryOnly: true,
    ),
    LaundryService(
      id: 'ecowash',
      name: 'Ecowash Full Service',
      description: 'Wash, dry and fold with a 5 kg load basis',
      basePrice: 220,
      capacityKg: 5,
      image: 'svc_wash.png',
    ),
    LaundryService(
      id: 'basic',
      name: 'Basic Full Service',
      description: 'Standard wash, dry and fold',
      basePrice: 240,
      largePrice: 245,
      capacityKg: 8,
      image: 'svc_fullservice.png',
    ),
    LaundryService(
      id: 'premium',
      name: 'Premium Full Service',
      description: 'Premium care, wash, dry and fold',
      basePrice: 270,
      largePrice: 275,
      capacityKg: 8,
      image: 'svc_dry.png',
    ),
    LaundryService(
      id: 'handwash',
      name: 'Handwash',
      description: 'Gentle handwashing, priced per kilogram',
      basePrice: 150,
      capacityKg: 8,
      image: 'svc_handwash.png',
      perKg: true,
    ),
  ];
  static const detergents = [
    Supply('surf', 'Surf (Basic Det.)', 25),
    Supply('ariel', 'Ariel (Premium Det.)', 30),
    Supply('breeze_baby', 'Breeze Baby (Hypoallergenic)', 35),
    Supply('unilove', 'UniLove Baby (Hypoallergenic)', 35),
  ];
  static const conditioners = [
    Supply('charm', 'Charm Fabcon (Basic)', 15),
    Supply('downy', 'Downy (Premium)', 25),
  ];
  static const slots = [
    '8:00 AM - 9:30 AM',
    '9:30 AM - 11:00 AM',
    '11:00 AM - 12:30 PM',
    '1:00 PM - 2:30 PM',
    '2:30 PM - 4:00 PM',
    '4:00 PM - 5:30 PM',
  ];
  static bool slotAvailable(DateTime date, String slot, {DateTime? now}) {
    final current = now ?? DateTime.now();
    final match = RegExp(r'^(\d{1,2}):(\d{2}) (AM|PM)').firstMatch(slot);
    if (match == null) return false;
    final hour = int.parse(match[1]!) % 12 + (match[3] == 'PM' ? 12 : 0);
    return DateTime(
      date.year,
      date.month,
      date.day,
      hour,
      int.parse(match[2]!),
    ).isAfter(current);
  }
}
