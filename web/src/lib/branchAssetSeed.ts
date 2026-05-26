/**
 * Branch Asset seed initializer.
 * Runs once per browser session (guarded by localStorage flag).
 * Inserts 12 realistic records per branch (120 total) using only
 * values supported by the Add Inventory Item modal dropdowns.
 *
 * Idempotent: second run is a no-op because SEED_FLAG_KEY is set after first run.
 * Safe: never deletes or overwrites existing records; only appends missing ones.
 */

const STORAGE_KEY = "washalert_branch_assets";
const SEED_FLAG_KEY = "washalert_assets_seed_v1";

type AssetCondition = "Working" | "For Repair" | "Broken";

interface StoredAsset {
  id: string;
  productId: string;
  name: string;
  category: string;
  condition: AssetCondition;
  quantity: number;
  branch: string;
  notes: string;
  addedAt: string;
  unit?: string;
  purchaseDate?: string;
  lastInspected?: string;
  brand?: string;
  purchasePrice?: number;
}

interface SeedRecord {
  productId: string;
  branch: string;
  category: string;
  name: string;
  brand: string;
  condition: AssetCondition;
  quantity: number;
  unit: string;
  purchaseDate: string;
  purchasePrice: number;
  notes: string;
}

// ─── Seed Data ──────────────────────────────────────────────────────────────
// 12 records × 10 branches = 120 total.
// All values use only dropdown options from BranchAssetsPage.tsx:
//   Categories: Appliance | Furniture | Equipment | Electronics | Other
//   Appliance items: Washing Machine, Dryer, Air Conditioner, Refrigerator,
//                    Electric Fan, Television, Water Dispenser, Microwave
//   Furniture items: Folding Table, Plastic Chair, Metal Rack, Sofa / Couch,
//                    Laundry Basket Cart, Office Chair, Stool, Cabinet
//   Equipment items: Water Pump, Water Tank, Steam Iron, Dry Vacuum Cleaner,
//                    Weighing Scale, CCTV Camera System, POS Terminal,
//                    Pressure Washer, Generator
//   Electronics items: Tablet (POS), Smart Phone, WiFi Router, Smart TV,
//                      Barcode Scanner, Thermal Printer, Bluetooth Speaker
//   Other items: Fire Extinguisher, First Aid Kit, Cleaning Cart, Step Ladder
//   Appliance brands: Samsung, LG, Panasonic, Sharp, Toshiba, Fujidenzo,
//                     Carrier, Midea, Condura, Standard, LG Giant C,
//                     Whirlpool, Maytag, Speed Queen
//   Furniture brands: Uratex, Orocan, San-Yang, IKEA, Mandaue Foam, Generic
//   Equipment brands: Matrix, Karcher, Standard, Hikvision, Xiaomi,
//                     Imarflex, Asahi, Yamaha, Seco
//   Electronics brands: Apple, Samsung, Xiaomi, TP-Link, Epson, Sunmi, Realme
//   Other brands: First Alert, Falcon, Generic
//   Conditions: Working | For Repair | Broken

const SEED_RECORDS: SeedRecord[] = [
  // ── BROOKSIDE BRANCH ─────────────────────────────────────────────────────
  { productId: "BRK-001", branch: "Brookside Branch", category: "Appliance",   name: "Washing Machine",     brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-15", purchasePrice: 45000, notes: "Main washer near washing area" },
  { productId: "BRK-002", branch: "Brookside Branch", category: "Appliance",   name: "Washing Machine",     brand: "Samsung",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-15", purchasePrice: 42000, notes: "Secondary washer, right side" },
  { productId: "BRK-003", branch: "Brookside Branch", category: "Appliance",   name: "Dryer",               brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-02-20", purchasePrice: 38000, notes: "Industrial dryer unit" },
  { productId: "BRK-004", branch: "Brookside Branch", category: "Appliance",   name: "Air Conditioner",     brand: "Carrier",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-10", purchasePrice: 28000, notes: "Lobby area aircon" },
  { productId: "BRK-005", branch: "Brookside Branch", category: "Appliance",   name: "Electric Fan",        brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-01", purchasePrice: 2500,  notes: "Staff area cooling fan" },
  { productId: "BRK-006", branch: "Brookside Branch", category: "Appliance",   name: "Water Dispenser",     brand: "Fujidenzo", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-05", purchasePrice: 8500,  notes: "Customer waiting area" },
  { productId: "BRK-007", branch: "Brookside Branch", category: "Furniture",   name: "Folding Table",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-12", purchasePrice: 2800,  notes: "Used for folding clothes" },
  { productId: "BRK-008", branch: "Brookside Branch", category: "Furniture",   name: "Plastic Chair",       brand: "Orocan",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-12", purchasePrice: 450,   notes: "Customer waiting area" },
  { productId: "BRK-009", branch: "Brookside Branch", category: "Furniture",   name: "Metal Rack",          brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-09-01", purchasePrice: 3500,  notes: "Storage rack for laundry supplies" },
  { productId: "BRK-010", branch: "Brookside Branch", category: "Equipment",   name: "Weighing Scale",      brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-10", purchasePrice: 4500,  notes: "Used to weigh laundry per kg" },
  { productId: "BRK-011", branch: "Brookside Branch", category: "Equipment",   name: "CCTV Camera System",  brand: "Hikvision", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-11-15", purchasePrice: 12000, notes: "Security monitoring system" },
  { productId: "BRK-012", branch: "Brookside Branch", category: "Other",       name: "Fire Extinguisher",   brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-10", purchasePrice: 1800,  notes: "Safety equipment near entrance" },

  // ── CHESTNUT BRANCH ──────────────────────────────────────────────────────
  { productId: "CHE-001", branch: "Chestnut Branch",  category: "Appliance",   name: "Washing Machine",     brand: "Samsung",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-11-20", purchasePrice: 43000, notes: "Front loader washer, main unit" },
  { productId: "CHE-002", branch: "Chestnut Branch",  category: "Appliance",   name: "Washing Machine",     brand: "Condura",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-08", purchasePrice: 38500, notes: "Top loader washer, backup unit" },
  { productId: "CHE-003", branch: "Chestnut Branch",  category: "Appliance",   name: "Dryer",               brand: "Samsung",   condition: "For Repair", quantity: 1, unit: "units", purchaseDate: "2023-09-15", purchasePrice: 36000, notes: "Needs technician inspection" },
  { productId: "CHE-004", branch: "Chestnut Branch",  category: "Appliance",   name: "Air Conditioner",     brand: "Panasonic", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-05-20", purchasePrice: 30000, notes: "Main hall aircon" },
  { productId: "CHE-005", branch: "Chestnut Branch",  category: "Appliance",   name: "Refrigerator",        brand: "Sharp",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-01", purchasePrice: 18000, notes: "Staff area refrigerator" },
  { productId: "CHE-006", branch: "Chestnut Branch",  category: "Appliance",   name: "Electric Fan",        brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-05", purchasePrice: 2200,  notes: "Backup fan, storage area" },
  { productId: "CHE-007", branch: "Chestnut Branch",  category: "Furniture",   name: "Folding Table",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-15", purchasePrice: 2800,  notes: "Folding station table" },
  { productId: "CHE-008", branch: "Chestnut Branch",  category: "Furniture",   name: "Plastic Chair",       brand: "Orocan",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-15", purchasePrice: 450,   notes: "Customer waiting area" },
  { productId: "CHE-009", branch: "Chestnut Branch",  category: "Furniture",   name: "Cabinet",             brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-12-01", purchasePrice: 5500,  notes: "Document and record storage" },
  { productId: "CHE-010", branch: "Chestnut Branch",  category: "Equipment",   name: "Steam Iron",          brand: "Imarflex",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-02-01", purchasePrice: 3200,  notes: "Garment pressing station" },
  { productId: "CHE-011", branch: "Chestnut Branch",  category: "Equipment",   name: "POS Terminal",        brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-20", purchasePrice: 15000, notes: "Payment counter terminal" },
  { productId: "CHE-012", branch: "Chestnut Branch",  category: "Other",       name: "First Aid Kit",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-05", purchasePrice: 800,   notes: "Staff safety kit near counter" },

  // ── HOLY SPIRIT BRANCH ───────────────────────────────────────────────────
  { productId: "HSB-001", branch: "Holy Spirit Branch", category: "Appliance", name: "Washing Machine",     brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-02-01", purchasePrice: 46000, notes: "Primary commercial washer" },
  { productId: "HSB-002", branch: "Holy Spirit Branch", category: "Appliance", name: "Washing Machine",     brand: "Whirlpool", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-02-01", purchasePrice: 44000, notes: "Secondary washer unit" },
  { productId: "HSB-003", branch: "Holy Spirit Branch", category: "Appliance", name: "Dryer",               brand: "Panasonic", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-03-10", purchasePrice: 37000, notes: "Main dryer unit" },
  { productId: "HSB-004", branch: "Holy Spirit Branch", category: "Appliance", name: "Air Conditioner",     brand: "Midea",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-15", purchasePrice: 25000, notes: "Waiting area aircon" },
  { productId: "HSB-005", branch: "Holy Spirit Branch", category: "Appliance", name: "Water Dispenser",     brand: "Condura",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-09-01", purchasePrice: 9000,  notes: "Customer water station" },
  { productId: "HSB-006", branch: "Holy Spirit Branch", category: "Appliance", name: "Television",          brand: "Samsung",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-12-10", purchasePrice: 22000, notes: "Customer entertainment display" },
  { productId: "HSB-007", branch: "Holy Spirit Branch", category: "Furniture", name: "Folding Table",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-05-20", purchasePrice: 2800,  notes: "Sorting and folding station" },
  { productId: "HSB-008", branch: "Holy Spirit Branch", category: "Furniture", name: "Plastic Chair",       brand: "Orocan",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-05-20", purchasePrice: 450,   notes: "Customer seating" },
  { productId: "HSB-009", branch: "Holy Spirit Branch", category: "Furniture", name: "Laundry Basket Cart", brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-10", purchasePrice: 3000,  notes: "Laundry transport cart" },
  { productId: "HSB-010", branch: "Holy Spirit Branch", category: "Equipment", name: "Weighing Scale",      brand: "Asahi",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-20", purchasePrice: 4200,  notes: "Laundry weighing at counter" },
  { productId: "HSB-011", branch: "Holy Spirit Branch", category: "Equipment", name: "CCTV Camera System",  brand: "Hikvision", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-15", purchasePrice: 14000, notes: "4-camera branch monitoring" },
  { productId: "HSB-012", branch: "Holy Spirit Branch", category: "Other",     name: "Fire Extinguisher",   brand: "Falcon",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-02-05", purchasePrice: 2000,  notes: "Near electrical panel area" },

  // ── JP RIZAL BRANCH ──────────────────────────────────────────────────────
  { productId: "JPR-001", branch: "JP Rizal Branch",  category: "Appliance",   name: "Washing Machine",     brand: "Speed Queen", condition: "Working",  quantity: 1, unit: "units", purchaseDate: "2023-08-15", purchasePrice: 55000, notes: "Commercial-grade washer, main" },
  { productId: "JPR-002", branch: "JP Rizal Branch",  category: "Appliance",   name: "Washing Machine",     brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-15", purchasePrice: 45000, notes: "Front loader, secondary unit" },
  { productId: "JPR-003", branch: "JP Rizal Branch",  category: "Appliance",   name: "Dryer",               brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-09-01", purchasePrice: 40000, notes: "Main drying unit" },
  { productId: "JPR-004", branch: "JP Rizal Branch",  category: "Appliance",   name: "Air Conditioner",     brand: "Carrier",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-04-10", purchasePrice: 32000, notes: "Main branch aircon" },
  { productId: "JPR-005", branch: "JP Rizal Branch",  category: "Appliance",   name: "Electric Fan",        brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-01", purchasePrice: 2500,  notes: "Backup ventilation fan" },
  { productId: "JPR-006", branch: "JP Rizal Branch",  category: "Appliance",   name: "Water Dispenser",     brand: "Fujidenzo", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-20", purchasePrice: 8500,  notes: "Customer waiting area" },
  { productId: "JPR-007", branch: "JP Rizal Branch",  category: "Furniture",   name: "Folding Table",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-05", purchasePrice: 3000,  notes: "Clothes sorting area" },
  { productId: "JPR-008", branch: "JP Rizal Branch",  category: "Furniture",   name: "Metal Rack",          brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-05", purchasePrice: 4000,  notes: "Supply and detergent storage" },
  { productId: "JPR-009", branch: "JP Rizal Branch",  category: "Furniture",   name: "Plastic Chair",       brand: "Orocan",    condition: "For Repair", quantity: 1, unit: "units", purchaseDate: "2023-07-05", purchasePrice: 450,   notes: "Customer chair, leg cracked" },
  { productId: "JPR-010", branch: "JP Rizal Branch",  category: "Equipment",   name: "Weighing Scale",      brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-11-01", purchasePrice: 4500,  notes: "Laundry weight station" },
  { productId: "JPR-011", branch: "JP Rizal Branch",  category: "Electronics", name: "WiFi Router",         brand: "TP-Link",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-10", purchasePrice: 2800,  notes: "Branch internet connection" },
  { productId: "JPR-012", branch: "JP Rizal Branch",  category: "Other",       name: "First Aid Kit",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-15", purchasePrice: 800,   notes: "Basic first aid station" },

  // ── LUZON BRANCH ─────────────────────────────────────────────────────────
  { productId: "LZN-001", branch: "Luzon Branch",     category: "Appliance",   name: "Washing Machine",     brand: "Maytag",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-05", purchasePrice: 50000, notes: "High-capacity commercial washer" },
  { productId: "LZN-002", branch: "Luzon Branch",     category: "Appliance",   name: "Washing Machine",     brand: "Samsung",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-05", purchasePrice: 42000, notes: "Standard load washer, unit 2" },
  { productId: "LZN-003", branch: "Luzon Branch",     category: "Appliance",   name: "Dryer",               brand: "Samsung",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-11-01", purchasePrice: 38500, notes: "Main dryer unit" },
  { productId: "LZN-004", branch: "Luzon Branch",     category: "Appliance",   name: "Air Conditioner",     brand: "Sharp",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-05-15", purchasePrice: 27000, notes: "Branch main aircon" },
  { productId: "LZN-005", branch: "Luzon Branch",     category: "Appliance",   name: "Refrigerator",        brand: "Condura",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-09-20", purchasePrice: 17500, notes: "Staff area refrigerator" },
  { productId: "LZN-006", branch: "Luzon Branch",     category: "Appliance",   name: "Electric Fan",        brand: "Standard",  condition: "Broken",     quantity: 1, unit: "units", purchaseDate: "2022-11-10", purchasePrice: 2200,  notes: "Broken motor, for disposal" },
  { productId: "LZN-007", branch: "Luzon Branch",     category: "Furniture",   name: "Folding Table",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-01", purchasePrice: 2800,  notes: "Clothes folding station" },
  { productId: "LZN-008", branch: "Luzon Branch",     category: "Furniture",   name: "Plastic Chair",       brand: "Orocan",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-01", purchasePrice: 450,   notes: "Customer waiting seat" },
  { productId: "LZN-009", branch: "Luzon Branch",     category: "Furniture",   name: "Cabinet",             brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-15", purchasePrice: 5000,  notes: "Branch records and document cabinet" },
  { productId: "LZN-010", branch: "Luzon Branch",     category: "Equipment",   name: "Steam Iron",          brand: "Imarflex",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-02-10", purchasePrice: 3200,  notes: "Used for garment pressing" },
  { productId: "LZN-011", branch: "Luzon Branch",     category: "Equipment",   name: "CCTV Camera System",  brand: "Hikvision", condition: "For Repair", quantity: 1, unit: "units", purchaseDate: "2023-07-20", purchasePrice: 13000, notes: "Camera 3 offline, being repaired" },
  { productId: "LZN-012", branch: "Luzon Branch",     category: "Other",       name: "Fire Extinguisher",   brand: "First Alert", condition: "Working",  quantity: 1, unit: "units", purchaseDate: "2024-02-01", purchasePrice: 1800,  notes: "Safety unit near exit" },

  // ── MAKATI BRANCH ────────────────────────────────────────────────────────
  { productId: "MKT-001", branch: "Makati Branch",    category: "Appliance",   name: "Washing Machine",     brand: "LG Giant C", condition: "Working",   quantity: 1, unit: "units", purchaseDate: "2023-06-01", purchasePrice: 58000, notes: "Large-capacity front loader, main" },
  { productId: "MKT-002", branch: "Makati Branch",    category: "Appliance",   name: "Washing Machine",     brand: "Speed Queen", condition: "Working",  quantity: 1, unit: "units", purchaseDate: "2023-06-01", purchasePrice: 55000, notes: "Heavy-duty washer, unit 2" },
  { productId: "MKT-003", branch: "Makati Branch",    category: "Appliance",   name: "Dryer",               brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-01", purchasePrice: 42000, notes: "Industrial dryer, main unit" },
  { productId: "MKT-004", branch: "Makati Branch",    category: "Appliance",   name: "Air Conditioner",     brand: "Carrier",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-03-15", purchasePrice: 35000, notes: "Main branch AC, reception area" },
  { productId: "MKT-005", branch: "Makati Branch",    category: "Appliance",   name: "Television",          brand: "Samsung",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-12-01", purchasePrice: 24000, notes: "Customer waiting area TV" },
  { productId: "MKT-006", branch: "Makati Branch",    category: "Appliance",   name: "Water Dispenser",     brand: "Midea",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-10", purchasePrice: 9500,  notes: "Customer self-serve station" },
  { productId: "MKT-007", branch: "Makati Branch",    category: "Furniture",   name: "Sofa / Couch",        brand: "Uratex",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-20", purchasePrice: 12000, notes: "Customer waiting area lounge" },
  { productId: "MKT-008", branch: "Makati Branch",    category: "Furniture",   name: "Folding Table",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-10", purchasePrice: 3000,  notes: "Back-area folding station" },
  { productId: "MKT-009", branch: "Makati Branch",    category: "Furniture",   name: "Metal Rack",          brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-10", purchasePrice: 4500,  notes: "Supply and inventory shelving" },
  { productId: "MKT-010", branch: "Makati Branch",    category: "Equipment",   name: "POS Terminal",        brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-09-01", purchasePrice: 18000, notes: "Main payment counter" },
  { productId: "MKT-011", branch: "Makati Branch",    category: "Electronics", name: "Tablet (POS)",        brand: "Samsung",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-20", purchasePrice: 14000, notes: "Staff operations tablet" },
  { productId: "MKT-012", branch: "Makati Branch",    category: "Equipment",   name: "CCTV Camera System",  brand: "Hikvision", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-05", purchasePrice: 16000, notes: "6-camera security system" },

  // ── REPUBLIC BRANCH ──────────────────────────────────────────────────────
  { productId: "RPB-001", branch: "Republic Branch",  category: "Appliance",   name: "Washing Machine",     brand: "Samsung",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-10", purchasePrice: 43000, notes: "Main commercial washer" },
  { productId: "RPB-002", branch: "Republic Branch",  category: "Appliance",   name: "Washing Machine",     brand: "Toshiba",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-10", purchasePrice: 39000, notes: "Secondary washer unit" },
  { productId: "RPB-003", branch: "Republic Branch",  category: "Appliance",   name: "Dryer",               brand: "Sharp",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-02-15", purchasePrice: 36000, notes: "Main dryer unit" },
  { productId: "RPB-004", branch: "Republic Branch",  category: "Appliance",   name: "Air Conditioner",     brand: "Panasonic", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-05-10", purchasePrice: 29000, notes: "Customer area aircon" },
  { productId: "RPB-005", branch: "Republic Branch",  category: "Appliance",   name: "Electric Fan",        brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-01", purchasePrice: 2500,  notes: "Staff area fan" },
  { productId: "RPB-006", branch: "Republic Branch",  category: "Appliance",   name: "Microwave",           brand: "Sharp",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-11-10", purchasePrice: 5500,  notes: "Staff break area microwave" },
  { productId: "RPB-007", branch: "Republic Branch",  category: "Furniture",   name: "Folding Table",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-20", purchasePrice: 2800,  notes: "Folding and sorting station" },
  { productId: "RPB-008", branch: "Republic Branch",  category: "Furniture",   name: "Office Chair",        brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-09-05", purchasePrice: 3500,  notes: "Staff desk chair" },
  { productId: "RPB-009", branch: "Republic Branch",  category: "Furniture",   name: "Metal Rack",          brand: "Generic",   condition: "For Repair", quantity: 1, unit: "units", purchaseDate: "2023-04-15", purchasePrice: 3500,  notes: "Shelf bracket loose, needs repair" },
  { productId: "RPB-010", branch: "Republic Branch",  category: "Equipment",   name: "Weighing Scale",      brand: "Asahi",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-03-01", purchasePrice: 4200,  notes: "Customer laundry weight station" },
  { productId: "RPB-011", branch: "Republic Branch",  category: "Electronics", name: "WiFi Router",         brand: "TP-Link",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-12-20", purchasePrice: 2800,  notes: "Branch internet for staff use" },
  { productId: "RPB-012", branch: "Republic Branch",  category: "Other",       name: "Fire Extinguisher",   brand: "First Alert", condition: "Working",  quantity: 1, unit: "units", purchaseDate: "2024-02-10", purchasePrice: 1800,  notes: "Main safety unit near entrance" },

  // ── ST. ANTHONY BRANCH ───────────────────────────────────────────────────
  { productId: "STA-001", branch: "St. Anthony Branch", category: "Appliance", name: "Washing Machine",     brand: "Condura",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-12-01", purchasePrice: 40000, notes: "Main washer unit" },
  { productId: "STA-002", branch: "St. Anthony Branch", category: "Appliance", name: "Washing Machine",     brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-12-01", purchasePrice: 44000, notes: "Secondary washer unit" },
  { productId: "STA-003", branch: "St. Anthony Branch", category: "Appliance", name: "Dryer",               brand: "Condura",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-20", purchasePrice: 35000, notes: "Main drying unit" },
  { productId: "STA-004", branch: "St. Anthony Branch", category: "Appliance", name: "Air Conditioner",     brand: "Midea",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-05", purchasePrice: 24000, notes: "Waiting room aircon" },
  { productId: "STA-005", branch: "St. Anthony Branch", category: "Appliance", name: "Electric Fan",        brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-15", purchasePrice: 2200,  notes: "Staff area fan" },
  { productId: "STA-006", branch: "St. Anthony Branch", category: "Appliance", name: "Water Dispenser",     brand: "Condura",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-09-15", purchasePrice: 8000,  notes: "Customer waiting station" },
  { productId: "STA-007", branch: "St. Anthony Branch", category: "Furniture", name: "Folding Table",       brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-20", purchasePrice: 2800,  notes: "Sorting and folding area" },
  { productId: "STA-008", branch: "St. Anthony Branch", category: "Furniture", name: "Plastic Chair",       brand: "Orocan",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-20", purchasePrice: 450,   notes: "Customer waiting chairs" },
  { productId: "STA-009", branch: "St. Anthony Branch", category: "Furniture", name: "Laundry Basket Cart", brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-01", purchasePrice: 3000,  notes: "For transporting laundry" },
  { productId: "STA-010", branch: "St. Anthony Branch", category: "Equipment", name: "Steam Iron",          brand: "Imarflex",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-05", purchasePrice: 3500,  notes: "Pressing station" },
  { productId: "STA-011", branch: "St. Anthony Branch", category: "Equipment", name: "CCTV Camera System",  brand: "Hikvision", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-11-01", purchasePrice: 12500, notes: "Security camera system" },
  { productId: "STA-012", branch: "St. Anthony Branch", category: "Other",     name: "First Aid Kit",       brand: "Falcon",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-15", purchasePrice: 950,   notes: "Emergency safety kit" },

  // ── STA. CATALINA BRANCH ─────────────────────────────────────────────────
  { productId: "STC-001", branch: "Sta. Catalina Branch", category: "Appliance", name: "Washing Machine",   brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-09-10", purchasePrice: 45000, notes: "Main commercial washer" },
  { productId: "STC-002", branch: "Sta. Catalina Branch", category: "Appliance", name: "Washing Machine",   brand: "Samsung",   condition: "For Repair", quantity: 1, unit: "units", purchaseDate: "2023-09-10", purchasePrice: 42000, notes: "Water inlet valve replacement needed" },
  { productId: "STC-003", branch: "Sta. Catalina Branch", category: "Appliance", name: "Dryer",             brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-05", purchasePrice: 39000, notes: "Main drying unit" },
  { productId: "STC-004", branch: "Sta. Catalina Branch", category: "Appliance", name: "Air Conditioner",   brand: "Carrier",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-04-20", purchasePrice: 31000, notes: "Main branch AC unit" },
  { productId: "STC-005", branch: "Sta. Catalina Branch", category: "Appliance", name: "Electric Fan",      brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-07-10", purchasePrice: 2500,  notes: "Ventilation for waiting area" },
  { productId: "STC-006", branch: "Sta. Catalina Branch", category: "Appliance", name: "Refrigerator",      brand: "Sharp",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-12-15", purchasePrice: 17000, notes: "Staff area refrigerator" },
  { productId: "STC-007", branch: "Sta. Catalina Branch", category: "Furniture", name: "Folding Table",     brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-10", purchasePrice: 2800,  notes: "Clothes sorting and folding area" },
  { productId: "STC-008", branch: "Sta. Catalina Branch", category: "Furniture", name: "Plastic Chair",     brand: "Orocan",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-10", purchasePrice: 450,   notes: "Customer seating" },
  { productId: "STC-009", branch: "Sta. Catalina Branch", category: "Furniture", name: "Metal Rack",        brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-20", purchasePrice: 4000,  notes: "Supply storage rack" },
  { productId: "STC-010", branch: "Sta. Catalina Branch", category: "Equipment", name: "Weighing Scale",    brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-12-01", purchasePrice: 4500,  notes: "Laundry weight station" },
  { productId: "STC-011", branch: "Sta. Catalina Branch", category: "Equipment", name: "POS Terminal",      brand: "Standard",  condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-08", purchasePrice: 15000, notes: "Payment counter terminal" },
  { productId: "STC-012", branch: "Sta. Catalina Branch", category: "Other",     name: "Fire Extinguisher", brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-15", purchasePrice: 1800,  notes: "Safety equipment near door" },

  // ── UP DILIMAN / SAN VICENTE BRANCH ──────────────────────────────────────
  { productId: "UPD-001", branch: "UP Diliman / San Vicente Branch", category: "Appliance",   name: "Washing Machine",    brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-11-05", purchasePrice: 46000, notes: "Main commercial washer" },
  { productId: "UPD-002", branch: "UP Diliman / San Vicente Branch", category: "Appliance",   name: "Washing Machine",    brand: "Whirlpool", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-11-05", purchasePrice: 44000, notes: "Secondary washer unit" },
  { productId: "UPD-003", branch: "UP Diliman / San Vicente Branch", category: "Appliance",   name: "Dryer",              brand: "Samsung",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-12-01", purchasePrice: 38000, notes: "Industrial drying unit" },
  { productId: "UPD-004", branch: "UP Diliman / San Vicente Branch", category: "Appliance",   name: "Air Conditioner",    brand: "Panasonic", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-06-15", purchasePrice: 30000, notes: "Customer area cooling" },
  { productId: "UPD-005", branch: "UP Diliman / San Vicente Branch", category: "Appliance",   name: "Television",         brand: "LG",        condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-01-10", purchasePrice: 20000, notes: "Customer area entertainment" },
  { productId: "UPD-006", branch: "UP Diliman / San Vicente Branch", category: "Appliance",   name: "Water Dispenser",    brand: "Midea",     condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-20", purchasePrice: 8000,  notes: "Self-serve water station" },
  { productId: "UPD-007", branch: "UP Diliman / San Vicente Branch", category: "Furniture",   name: "Folding Table",      brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-01", purchasePrice: 2800,  notes: "Sorting and folding station" },
  { productId: "UPD-008", branch: "UP Diliman / San Vicente Branch", category: "Furniture",   name: "Plastic Chair",      brand: "Orocan",    condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-08-01", purchasePrice: 450,   notes: "Customer waiting seating" },
  { productId: "UPD-009", branch: "UP Diliman / San Vicente Branch", category: "Furniture",   name: "Cabinet",            brand: "Generic",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-09-15", purchasePrice: 5500,  notes: "Branch document cabinet" },
  { productId: "UPD-010", branch: "UP Diliman / San Vicente Branch", category: "Equipment",   name: "CCTV Camera System", brand: "Hikvision", condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2023-10-10", purchasePrice: 13500, notes: "Branch security system" },
  { productId: "UPD-011", branch: "UP Diliman / San Vicente Branch", category: "Electronics", name: "WiFi Router",        brand: "TP-Link",   condition: "Working",    quantity: 1, unit: "units", purchaseDate: "2024-02-01", purchasePrice: 2800,  notes: "Branch internet connectivity" },
  { productId: "UPD-012", branch: "UP Diliman / San Vicente Branch", category: "Other",       name: "Fire Extinguisher",  brand: "First Alert", condition: "Working",  quantity: 1, unit: "units", purchaseDate: "2024-02-10", purchasePrice: 1800,  notes: "Safety equipment near entrance" },
];

// ─── Seeder ──────────────────────────────────────────────────────────────────

export function runBranchAssetSeedOnce(): void {
  try {
    if (localStorage.getItem(SEED_FLAG_KEY)) return;

    const existing: StoredAsset[] = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as StoredAsset[]) : [];
      } catch {
        return [];
      }
    })();

    const existingIds = new Set(
      existing.map((a) => (a.productId ?? "").toLowerCase()),
    );

    let inserted = 0;
    let skipped = 0;
    const toInsert: StoredAsset[] = [];

    for (const r of SEED_RECORDS) {
      if (existingIds.has(r.productId.toLowerCase())) {
        skipped++;
        continue;
      }
      toInsert.push({
        id: `seed-${r.productId}`,
        productId: r.productId,
        name: r.name,
        category: r.category,
        condition: r.condition,
        quantity: r.quantity,
        branch: r.branch,
        notes: r.notes,
        addedAt: new Date(r.purchaseDate).toISOString(),
        unit: r.unit,
        purchaseDate: r.purchaseDate,
        lastInspected: undefined,
        brand: r.brand,
        purchasePrice: r.purchasePrice,
      });
      inserted++;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...toInsert]));
    localStorage.setItem(SEED_FLAG_KEY, "1");

    console.log(
      `[BranchAssetSeed] Done — inserted: ${inserted}, skipped (already exist): ${skipped}`,
    );
  } catch (err) {
    console.warn("[BranchAssetSeed] Seeding failed:", err);
  }
}
