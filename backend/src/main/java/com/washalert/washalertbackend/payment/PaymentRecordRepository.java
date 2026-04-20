package com.washalert.washalertbackend.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentRecordRepository extends JpaRepository<PaymentRecord, Long> {
    Optional<PaymentRecord> findByJobOrder_TrackingNumber(String trackingNumber);
    List<PaymentRecord> findByJobOrder_BranchIgnoreCaseOrderBySubmittedAtDesc(String branch);
    List<PaymentRecord> findAllByOrderBySubmittedAtDesc();
    List<PaymentRecord> findBySubmittedAtBetween(LocalDateTime start, LocalDateTime end);
    List<PaymentRecord> findByJobOrder_BranchIgnoreCaseAndSubmittedAtBetween(String branch, LocalDateTime start, LocalDateTime end);
    List<PaymentRecord> findByJobOrder_IdIn(List<Long> jobOrderIds);
}
