package com.washalert.washalertbackend.orders;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import com.washalert.washalertbackend.payment.PaymentStatus;

public interface JobOrderRepository extends JpaRepository<JobOrder, Long> {
    Optional<JobOrder> findByTrackingNumber(String trackingNumber);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<JobOrder> findByTrackingNumberIgnoreCase(String trackingNumber);
    List<JobOrder> findByStatusInAndCreatedAtAfter(Collection<JobOrderStatus> statuses, LocalDateTime after);

    List<JobOrder> findTop10ByOrderByCreatedAtDesc();
    List<JobOrder> findAllByOrderByCreatedAtDesc();

    long countByStatus(JobOrderStatus status);
    List<JobOrder> findByStatus(JobOrderStatus status);
    Page<JobOrder> findByAssignedDriverAndStatusIn(User driver, Collection<JobOrderStatus> statuses, Pageable pageable);

    @Query("""
        select jo from JobOrder jo
        where (jo.assignedPickupDriver = :driver or jo.assignedDeliveryDriver = :driver or jo.assignedDriver = :driver)
        and jo.status in :statuses
    """)
    Page<JobOrder> findDriverTasksPaged(
            @Param("driver") User driver,
            @Param("statuses") Collection<JobOrderStatus> statuses,
            Pageable pageable
    );

    // STAFF branch views
    List<JobOrder> findTop10ByBranchIgnoreCaseOrderByCreatedAtDesc(String branch);

    List<JobOrder> findByBranchIgnoreCaseOrderByCreatedAtDesc(String branch);
    List<JobOrder> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    List<JobOrder> findByBranchIgnoreCaseAndCreatedAtBetween(String branch, LocalDateTime start, LocalDateTime end);
    Optional<JobOrder> findTopByCustomerEmailIgnoreCaseOrderByCreatedAtDesc(String customerEmail);

    long countByStatusAndBranchIgnoreCase(JobOrderStatus status, String branch);

    List<JobOrder> findByBranchIgnoreCaseAndStatusIn(String branch, Collection<JobOrderStatus> statuses);

    long countByBranchIgnoreCaseAndBookingDateAndSlotStartTime(String branch, LocalDate bookingDate, LocalTime slotStartTime);

    List<JobOrder> findByStatusAndServiceTypeOrderByCreatedAtDesc(JobOrderStatus status, ServiceType serviceType);

    @Query(
            value = """
                    select jo
                    from JobOrder jo
                    where (:branch is null or replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', ''))
                      and (:statusesEmpty = true or jo.status in :statuses)
                      and (:search is null or lower(jo.trackingNumber) like lower(concat('%', :search, '%'))
                           or lower(jo.customerName) like lower(concat('%', :search, '%')))
                      and (:paymentMethod is null or upper(coalesce(jo.paymentMethod, '')) like concat('%', upper(:paymentMethod), '%'))
                      and (:fromDateTime is null or jo.createdAt >= :fromDateTime)
                      and (:toDateTime is null or jo.createdAt <= :toDateTime)
                      and (
                           :paymentStatus is null
                           or exists(
                               select pr.id from PaymentRecord pr
                               where pr.jobOrder = jo and pr.status = :paymentStatus
                           )
                           or (:includeOrderPaid = true and jo.isPaid = true)
                           or (
                               :includeImplicitPending = true
                               and jo.isPaid = false
                               and not exists(select pr0.id from PaymentRecord pr0 where pr0.jobOrder = jo)
                           )
                      )
                    """,
            countQuery = """
                    select count(jo)
                    from JobOrder jo
                    where (:branch is null or replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', ''))
                      and (:statusesEmpty = true or jo.status in :statuses)
                      and (:search is null or lower(jo.trackingNumber) like lower(concat('%', :search, '%'))
                           or lower(jo.customerName) like lower(concat('%', :search, '%')))
                      and (:paymentMethod is null or upper(coalesce(jo.paymentMethod, '')) like concat('%', upper(:paymentMethod), '%'))
                      and (:fromDateTime is null or jo.createdAt >= :fromDateTime)
                      and (:toDateTime is null or jo.createdAt <= :toDateTime)
                      and (
                           :paymentStatus is null
                           or exists(
                               select pr.id from PaymentRecord pr
                               where pr.jobOrder = jo and pr.status = :paymentStatus
                           )
                           or (:includeOrderPaid = true and jo.isPaid = true)
                           or (
                               :includeImplicitPending = true
                               and jo.isPaid = false
                               and not exists(select pr0.id from PaymentRecord pr0 where pr0.jobOrder = jo)
                           )
                      )
                    """
    )
    Page<JobOrder> findPagedWithFilters(
            @Param("branch") String branch,
            @Param("statuses") Collection<JobOrderStatus> statuses,
            @Param("statusesEmpty") boolean statusesEmpty,
            @Param("search") String search,
            @Param("paymentStatus") PaymentStatus paymentStatus,
            @Param("includeOrderPaid") boolean includeOrderPaid,
            @Param("includeImplicitPending") boolean includeImplicitPending,
            @Param("paymentMethod") String paymentMethod,
            @Param("fromDateTime") LocalDateTime fromDateTime,
            @Param("toDateTime") LocalDateTime toDateTime,
            Pageable pageable
    );

    @Query(
            value = """
                    select jo
                    from JobOrder jo
                    where lower(jo.customerEmail) = lower(:customerEmail)
                      and (:search is null or lower(jo.trackingNumber) like lower(concat('%', :search, '%'))
                           or lower(coalesce(jo.branch, '')) like lower(concat('%', :search, '%')))
                      and (:statusesEmpty = true or jo.status in :statuses)
                    """,
            countQuery = """
                    select count(jo)
                    from JobOrder jo
                    where lower(jo.customerEmail) = lower(:customerEmail)
                      and (:search is null or lower(jo.trackingNumber) like lower(concat('%', :search, '%'))
                           or lower(coalesce(jo.branch, '')) like lower(concat('%', :search, '%')))
                      and (:statusesEmpty = true or jo.status in :statuses)
                    """
    )
    Page<JobOrder> findCustomerOrdersPaged(
            @Param("customerEmail") String customerEmail,
            @Param("search") String search,
            @Param("statuses") Collection<JobOrderStatus> statuses,
            @Param("statusesEmpty") boolean statusesEmpty,
            Pageable pageable
    );
}
