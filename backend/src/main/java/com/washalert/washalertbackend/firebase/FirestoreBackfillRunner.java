package com.washalert.washalertbackend.firebase;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "washalert.firebase", name = "backfill-on-startup", havingValue = "true")
public class FirestoreBackfillRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(FirestoreBackfillRunner.class);
    private final FirestoreBackfillService backfillService;

    public FirestoreBackfillRunner(FirestoreBackfillService backfillService) {
        this.backfillService = backfillService;
    }

    @Override
    public void run(ApplicationArguments args) {
        FirestoreBackfillService.BackfillResult result = backfillService.runFullBackfill();
        log.info(
                "Firestore backfill completed: users={}, machines={}, inventory={}, orders={}, deliveries={}",
                result.users(),
                result.machines(),
                result.inventory(),
                result.orders(),
                result.deliveries()
        );
    }
}
