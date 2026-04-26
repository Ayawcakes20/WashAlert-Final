package com.washalert.washalertbackend.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentRecordRepository extends JpaRepository<PaymentRecord, Long> {
    Optional<PaymentRecord> findByJobOrder_TrackingNumber(String trackingNumber);
    List<PaymentRecord> findByJobOrder_BranchIgnoreCaseOrderBySubmittedAtDesc(String branch);
    List<PaymentRecord> findAllByOrderBySubmittedAtDesc();

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
            join fetch p.jobOrder jo
            where lower(jo.branch) = lower(:branch)
            order by p.submittedAt desc
            """)
    List<PaymentRecord> findByBranchWithJobOrderOrderBySubmittedAtDesc(@Param("branch") String branch);

    @Query("""
            select p
            from PaymentRecord p
            join fetch p.jobOrder
            order by p.submittedAt desc
            """)
    List<PaymentRecord> findAllWithJobOrderOrderBySubmittedAtDesc();

    List<PaymentRecord> findBySubmittedAtBetween(LocalDateTime start, LocalDateTime end);
    List<PaymentRecord> findByJobOrder_BranchIgnoreCaseAndSubmittedAtBetween(String branch, LocalDateTime start, LocalDateTime end);
    List<PaymentRecord> findByJobOrder_IdIn(List<Long> jobOrderIds);
}
