package com.washalert.washalertbackend.migration;

import com.washalert.washalertbackend.firebase.FirestoreBackfillService;
import com.washalert.washalertbackend.migration.dto.MigrationParityResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/migration")
@PreAuthorize("hasRole('ADMIN')")
public class MigrationAdminController {

    private final MigrationParityService migrationParityService;
    private final FirestoreBackfillService firestoreBackfillService;

    public MigrationAdminController(
            MigrationParityService migrationParityService,
            FirestoreBackfillService firestoreBackfillService
    ) {
        this.migrationParityService = migrationParityService;
        this.firestoreBackfillService = firestoreBackfillService;
    }

    @GetMapping("/parity")
    public MigrationParityResponse parityReport() {
        return migrationParityService.buildParityReport();
    }

    @PostMapping("/backfill")
    public FirestoreBackfillService.BackfillResult runBackfill() {
        return firestoreBackfillService.runFullBackfill();
    }
}
