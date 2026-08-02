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

    // Branch is free text with no canonical entity/FK (see BranchNames), so every query below
    // that filters/counts by branch normalizes the same way findPagedWithFilters (below) and
    // UserRepository.findInternalUsersPaged already do — a raw exact match silently returns
    // empty/zero whenever the caller's branch string and the stored branch string used a
    // different naming convention (e.g. "Quezon City" vs "Quezon City Branch").
    @Query("""
            select jo from JobOrder jo
            where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '')
              and jo.status in :statuses
              and jo.createdAt > :after
            """)
    List<JobOrder> findByNormalizedBranchAndStatusInAndCreatedAtAfter(
            @Param("branch") String branch, @Param("statuses") Collection<JobOrderStatus> statuses, @Param("after") LocalDateTime after);

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
    // Callers pass PageRequest.of(0, 10) to preserve the original findTop10By... behavior.
    @Query("select jo from JobOrder jo where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '') order by jo.createdAt desc")
    List<JobOrder> findTop10ByNormalizedBranchOrderByCreatedAtDesc(@Param("branch") String branch, Pageable pageable);

    @Query("select jo from JobOrder jo where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '') order by jo.createdAt desc")
    List<JobOrder> findByNormalizedBranchOrderByCreatedAtDesc(@Param("branch") String branch);

    List<JobOrder> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("select jo from JobOrder jo where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '') and jo.createdAt between :start and :end")
    List<JobOrder> findByNormalizedBranchAndCreatedAtBetween(@Param("branch") String branch, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    Optional<JobOrder> findTopByCustomerEmailIgnoreCaseOrderByCreatedAtDesc(String customerEmail);

    @Query("select count(jo) from JobOrder jo where jo.status = :status and replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '')")
    long countByStatusAndNormalizedBranch(@Param("status") JobOrderStatus status, @Param("branch") String branch);

    @Query("select jo from JobOrder jo where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '') and jo.status in :statuses")
    List<JobOrder> findByNormalizedBranchAndStatusIn(@Param("branch") String branch, @Param("statuses") Collection<JobOrderStatus> statuses);

    // Booking slot capacity check — the most serious consequence of the unnormalized-branch bug:
    // undercounting existing bookings for a slot lets a customer double-book an already-full slot.
    @Query("select count(jo) from JobOrder jo where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '') and jo.bookingDate = :bookingDate and jo.slotStartTime = :slotStartTime")
    long countByNormalizedBranchAndBookingDateAndSlotStartTime(@Param("branch") String branch, @Param("bookingDate") LocalDate bookingDate, @Param("slotStartTime") LocalTime slotStartTime);

    // Duplicate-booking guard — same risk class: a branch-string mismatch here means the guard
    // fails to find the customer's just-submitted pending booking, letting the same booking
    // through twice.
    @Query("""
            select jo from JobOrder jo
            where lower(jo.customerEmail) = lower(:customerEmail)
              and replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '')
              and jo.bookingDate = :bookingDate
              and jo.slotStartTime = :slotStartTime
              and jo.status = :status
              and jo.createdAt > :createdAfter
            """)
    List<JobOrder> findByCustomerEmailAndNormalizedBranchAndBookingDateAndSlotStartTimeAndStatusAndCreatedAtAfter(
            @Param("customerEmail") String customerEmail, @Param("branch") String branch, @Param("bookingDate") LocalDate bookingDate,
            @Param("slotStartTime") LocalTime slotStartTime, @Param("status") JobOrderStatus status, @Param("createdAfter") LocalDateTime createdAfter);

    List<JobOrder> findByStatusAndServiceTypeOrderByCreatedAtDesc(JobOrderStatus status, ServiceType serviceType);

    List<JobOrder> findByStatusInAndBookingDateBetween(Collection<JobOrderStatus> statuses, LocalDate start, LocalDate end);

    @Query("select jo from JobOrder jo where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '') and jo.status in :statuses and jo.bookingDate between :start and :end")
    List<JobOrder> findByNormalizedBranchAndStatusInAndBookingDateBetween(@Param("branch") String branch, @Param("statuses") Collection<JobOrderStatus> statuses, @Param("start") LocalDate start, @Param("end") LocalDate end);

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
