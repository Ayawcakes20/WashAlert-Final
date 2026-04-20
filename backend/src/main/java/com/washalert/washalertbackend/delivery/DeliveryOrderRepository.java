package com.washalert.washalertbackend.delivery;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DeliveryOrderRepository extends JpaRepository<DeliveryOrder, Long> {

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder jo
           where jo.trackingNumber = :trackingNumber
           and d.leg = :leg
           """)
    Optional<DeliveryOrder> findByJobOrder_TrackingNumberAndLeg(@Param("trackingNumber") String trackingNumber, @Param("leg") DeliveryLeg leg);

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder jo
           where jo.trackingNumber = :trackingNumber
           order by d.updatedAt desc
           """)
    List<DeliveryOrder> findByJobOrder_TrackingNumber(@Param("trackingNumber") String trackingNumber);

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder
           order by d.updatedAt desc
           """)
    List<DeliveryOrder> findAllByOrderByUpdatedAtDesc();

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder jo
           where lower(jo.branch) = lower(:branch)
           order by d.updatedAt desc
           """)
    List<DeliveryOrder> findByJobOrder_BranchIgnoreCaseOrderByUpdatedAtDesc(@Param("branch") String branch);

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder
           where d.id = :id
           """)
    Optional<DeliveryOrder> findWithJobOrderById(@Param("id") Long id);

    @Query("""
           select d
           from DeliveryOrder d
           join fetch d.jobOrder
           where d.driverUser.id = :driverUserId
           order by d.updatedAt desc
           """)
    List<DeliveryOrder> findByDriverUser_IdOrderByUpdatedAtDesc(@Param("driverUserId") Long driverUserId);
}
