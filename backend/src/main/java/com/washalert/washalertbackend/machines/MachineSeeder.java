package com.washalert.washalertbackend.machines;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Component
public class MachineSeeder implements CommandLineRunner {

    private final MachineRepository machineRepository;

    // These branch names must match:
    // 1. mobile/src/services/api.js BRANCH_CATALOG names
    // 2. web/src/pages/LoginPage.tsx branch list
    // 3. web/src/pages/UsersPage.tsx AVAILABLE_BRANCHES
    private static final String[] BRANCHES = {
            "Makati Branch", "UP Diliman", "JP Rizal", "S. Catalina",
            "Pasig City", "Republic Ave", "Chestnut St", "Tondo",
            "Samat St", "St. Nino"
    };

    // Reverse-migration: if the DB has long names (from a previous bad migration),
    // rename them back to the canonical short names used everywhere.
    private static final Map<String, String> REVERSE_RENAME_MAP = Map.of(
            "Triplets LaundryHubs - Makati", "Makati Branch",
            "SpeedyWash - UP Diliman",       "UP Diliman",
            "SpeedyWash - JP Rizal",         "JP Rizal",
            "SpeedyWash - S. Catalina",      "S. Catalina",
            "SpeedyWash - Pasig",            "Pasig City",
            "SpeedyWash - Republic",         "Republic Ave",
            "SpeedyWash - Chestnut",         "Chestnut St",
            "SpeedyWash - T.O.N",            "Tondo",
            "SpeedyWash - Samat",            "Samat St",
            "SpeedyWash - St. Nino",         "St. Nino"
    );

    public MachineSeeder(MachineRepository machineRepository) {
        this.machineRepository = machineRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        // Step 1: Fix any machines that were accidentally renamed to long names
        int fixed = 0;
        for (Map.Entry<String, String> entry : REVERSE_RENAME_MAP.entrySet()) {
            String wrongName = entry.getKey();
            String correctName = entry.getValue();
            var wrongMachines = machineRepository.findByBranchIgnoreCase(wrongName);
            if (!wrongMachines.isEmpty()) {
                for (Machine m : wrongMachines) {
                    m.setBranch(correctName);
                    machineRepository.save(m);
                    fixed++;
                }
            }
        }
        if (fixed > 0) {
            System.out.println("✅ Fixed " + fixed + " machine(s) — restored canonical short branch names.");
        }

        // Step 2: Seed only if no machines exist at all
        if (machineRepository.count() > 0) {
            System.out.println("ℹ️  Machines already exist (" + machineRepository.count() + "). Skipping seeder.");
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        for (String branch : BRANCHES) {
            String prefix = branch.replaceAll("\\s+", "").substring(0, 3).toUpperCase();
            for (int i = 1; i <= 5; i++) {
                machineRepository.save(Machine.builder()
                        .machineId(prefix + "-W-" + i)
                        .branch(branch)
                        .type(MachineType.WASHER)
                        .status(MachineStatus.AVAILABLE)
                        .updatedAt(now)
                        .build());
                machineRepository.save(Machine.builder()
                        .machineId(prefix + "-D-" + i)
                        .branch(branch)
                        .type(MachineType.DRYER)
                        .status(MachineStatus.AVAILABLE)
                        .updatedAt(now)
                        .build());
            }
        }
        System.out.println("✅ Seeded default machines. Total: " + machineRepository.count());
    }
}