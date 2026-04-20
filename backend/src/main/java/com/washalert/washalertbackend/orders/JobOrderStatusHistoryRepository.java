package com.washalert.washalertbackend.orders;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobOrderStatusHistoryRepository extends JpaRepository<JobOrderStatusHistory, Long> {
    List<JobOrderStatusHistory> findByJobOrder_IdOrderByChangedAtAsc(Long jobOrderId);
    List<JobOrderStatusHistory> findByJobOrder_TrackingNumberOrderByChangedAtAsc(String trackingNumber);
}
