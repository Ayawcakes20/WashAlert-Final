package com.washalert.washalertbackend.delivery;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DeliveryOrderRepository extends JpaRepository<DeliveryOrder, Long> {

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder jo
           left join fetch d.driverUser du
           where jo.trackingNumber = :trackingNumber
           and d.leg = :leg
           """)
    Optional<DeliveryOrder> findByJobOrder_TrackingNumberAndLeg(@Param("trackingNumber") String trackingNumber, @Param("leg") DeliveryLeg leg);

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder jo
           left join fetch d.driverUser du
           where jo.trackingNumber = :trackingNumber
           order by d.updatedAt desc
           """)
    List<DeliveryOrder> findByJobOrder_TrackingNumber(@Param("trackingNumber") String trackingNumber);

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder
           left join fetch d.driverUser
           order by d.updatedAt desc
           """)
    List<DeliveryOrder> findAllByOrderByUpdatedAtDesc();

    // Branch is free text with no canonical entity/FK (see BranchNames) — normalized the same
    // way JobOrderRepository/MachineRepository already are, so a delivery listing for a branch
    // doesn't silently come back empty on a naming-convention mismatch.
    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder jo
           left join fetch d.driverUser du
           where replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', '')
           order by d.updatedAt desc
           """)
    List<DeliveryOrder> findByJobOrderNormalizedBranchOrderByUpdatedAtDesc(@Param("branch") String branch);

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder
           left join fetch d.driverUser
           where d.id = :id
           """)
    Optional<DeliveryOrder> findWithJobOrderById(@Param("id") Long id);

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder
           left join fetch d.driverUser
           where d.driverUser.id = :driverUserId
           order by d.updatedAt desc
           """)
    List<DeliveryOrder> findByDriverUser_IdOrderByUpdatedAtDesc(@Param("driverUserId") Long driverUserId);

    @EntityGraph(attributePaths = {"jobOrder", "driverUser"})
    @Query(
            value = """
                    select d
                    from DeliveryOrder d
                    join d.jobOrder jo
                    where (:branch is null or replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', ''))
                      and (:status is null or d.status = :status)
                      and (:search is null or lower(jo.trackingNumber) like lower(concat('%', :search, '%'))
                           or lower(jo.customerName) like lower(concat('%', :search, '%'))
                           or lower(coalesce(d.driverName, '')) like lower(concat('%', :search, '%')))
                    """,
            countQuery = """
                    select count(d)
                    from DeliveryOrder d
                    join d.jobOrder jo
                    where (:branch is null or replace(lower(jo.branch), ' branch', '') = replace(lower(:branch), ' branch', ''))
                      and (:status is null or d.status = :status)
                      and (:search is null or lower(jo.trackingNumber) like lower(concat('%', :search, '%'))
                           or lower(jo.customerName) like lower(concat('%', :search, '%'))
                           or lower(coalesce(d.driverName, '')) like lower(concat('%', :search, '%')))
                    """
    )
    Page<DeliveryOrder> findOpsPaged(
            @Param("branch") String branch,
            @Param("status") DeliveryStatus status,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"jobOrder", "driverUser"})
    @Query(
            value = """
                    select d
                    from DeliveryOrder d
                    where d.driverUser.id = :driverUserId
                    order by d.updatedAt desc
                    """,
            countQuery = """
                    select count(d)
                    from DeliveryOrder d
                    where d.driverUser.id = :driverUserId
                    """
    )
    Page<DeliveryOrder> findByDriverUserIdPaged(
            @Param("driverUserId") Long driverUserId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"jobOrder", "driverUser"})
    @Query(
            value = """
                    select d
                    from DeliveryOrder d
                    where d.driverUser.id = :driverUserId
                      and d.status in :statuses
                    order by d.updatedAt desc
                    """,
            countQuery = """
                    select count(d)
                    from DeliveryOrder d
                    where d.driverUser.id = :driverUserId
                      and d.status in :statuses
                    """
    )
    Page<DeliveryOrder> findByDriverUserIdAndStatusInPaged(
            @Param("driverUserId") Long driverUserId,
            @Param("statuses") List<DeliveryStatus> statuses,
            Pageable pageable
    );

    boolean existsByJobOrder_IdAndDriverUser_Id(Long jobOrderId, Long driverUserId);
}
