package com.washalert.washalertbackend.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentRecordRepository extends JpaRepository<PaymentRecord, Long> {
    List<PaymentRecord> findByJobOrder_TrackingNumberOrderBySubmittedAtDesc(String trackingNumber);
    Optional<PaymentRecord> findByJobOrder_TrackingNumber(String trackingNumber);
    List<PaymentRecord> findAllByOrderBySubmittedAtDesc();

    // Branch is free text with no canonical entity/FK (see BranchNames) — normalized the same
    // way JobOrderRepository/MachineRepository/UserRepository already are, so a payment-records
    // view for a branch doesn't silently come back empty on a naming-convention mismatch.
    @Query("""
            select p
            from PaymentRecord p
            join fetch p.jobOrder jo
            where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '')
            order by p.submittedAt desc
            """)
    List<PaymentRecord> findByNormalizedBranchWithJobOrderOrderBySubmittedAtDesc(@Param("branch") String branch);

    @Query("""
            select p
            from PaymentRecord p
            join fetch p.jobOrder jo
            where upper(jo.trackingNumber) = upper(:trackingNumber)
            """)
    Optional<PaymentRecord> findByTrackingNumberWithJobOrder(@Param("trackingNumber") String trackingNumber);

    @Query("""
            select p
            from PaymentRecord p
            join fetch p.jobOrder
            order by p.submittedAt desc
            """)
    List<PaymentRecord> findAllWithJobOrderOrderBySubmittedAtDesc();

    List<PaymentRecord> findBySubmittedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("""
            select p
            from PaymentRecord p
            join p.jobOrder jo
            where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '')
              and p.submittedAt between :start and :end
            """)
    List<PaymentRecord> findByJobOrderNormalizedBranchAndSubmittedAtBetween(
            @Param("branch") String branch, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    List<PaymentRecord> findByJobOrder_IdIn(List<Long> jobOrderIds);
}
