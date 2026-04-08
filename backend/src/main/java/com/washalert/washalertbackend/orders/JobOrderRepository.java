package com.washalert.washalertbackend.orders;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

public interface JobOrderRepository extends JpaRepository<JobOrder, Long> {
    Optional<JobOrder> findByTrackingNumber(String trackingNumber);

    List<JobOrder> findTop10ByOrderByCreatedAtDesc();
    List<JobOrder> findAllByOrderByCreatedAtDesc();

    long countByStatus(JobOrderStatus status);

    // STAFF branch views
    List<JobOrder> findTop10ByBranchIgnoreCaseOrderByCreatedAtDesc(String branch);

    List<JobOrder> findByBranchIgnoreCaseOrderByCreatedAtDesc(String branch);
    List<JobOrder> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    List<JobOrder> findByBranchIgnoreCaseAndCreatedAtBetween(String branch, LocalDateTime start, LocalDateTime end);

    long countByStatusAndBranchIgnoreCase(JobOrderStatus status, String branch);

    long countByBranchIgnoreCaseAndBookingDateAndSlotStartTime(String branch, LocalDate bookingDate, LocalTime slotStartTime);
}
