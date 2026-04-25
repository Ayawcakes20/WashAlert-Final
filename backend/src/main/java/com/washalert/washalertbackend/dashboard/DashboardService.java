package com.washalert.washalertbackend.dashboard;

import com.washalert.washalertbackend.dashboard.dto.DashboardSummaryResponse;
import com.washalert.washalertbackend.machines.MachineRepository;
import com.washalert.washalertbackend.machines.MachineStatus;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DashboardService {

    private final JobOrderRepository orders;
    private final MachineRepository machines;
    private final JobOrderMapper mapper = new JobOrderMapper();

    public DashboardService(JobOrderRepository orders, MachineRepository machines) {
        this.orders = orders;
        this.machines = machines;
    }

    public DashboardSummaryResponse summary(AuthUserDetails principal) {
        User actor = principal.getUser();

        long pending;
        long washing;
        long drying;
        long ready;

        long available;
        long inUse;
        long maintenance;

        List<JobOrderResponse> recent;

        if (actor.getRole() == Role.ADMIN) {
            pending = orders.countByStatus(JobOrderStatus.PENDING);
            washing = orders.countByStatus(JobOrderStatus.WASHING);
            drying = orders.countByStatus(JobOrderStatus.DRYING);
            ready = orders.countByStatus(JobOrderStatus.READY);

            available = machines.countByStatus(MachineStatus.AVAILABLE);
            inUse = machines.countByStatus(MachineStatus.IN_USE);
            maintenance = machines.countByStatus(MachineStatus.MAINTENANCE);

            recent = orders.findTop10ByOrderByCreatedAtDesc()
                    .stream()
                    .map(mapper::toResponse)
                    .toList();
        } else {
            String branch = actor.getBranch();

            pending = orders.countByStatusAndBranchIgnoreCase(JobOrderStatus.PENDING, branch);
            washing = orders.countByStatusAndBranchIgnoreCase(JobOrderStatus.WASHING, branch);
            drying = orders.countByStatusAndBranchIgnoreCase(JobOrderStatus.DRYING, branch);
            ready = orders.countByStatusAndBranchIgnoreCase(JobOrderStatus.READY, branch);

            available = machines.countByStatusAndBranchIgnoreCase(MachineStatus.AVAILABLE, branch);
            inUse = machines.countByStatusAndBranchIgnoreCase(MachineStatus.IN_USE, branch);
            maintenance = machines.countByStatusAndBranchIgnoreCase(MachineStatus.MAINTENANCE, branch);

            recent = orders.findTop10ByBranchIgnoreCaseOrderByCreatedAtDesc(branch)
                    .stream()
                    .map(mapper::toResponse)
                    .toList();
        }

        return new DashboardSummaryResponse(
                new DashboardSummaryResponse.OrderSummary(pending, washing, drying, ready),
                new DashboardSummaryResponse.MachineSummary(available, inUse, maintenance),
                recent
        );
    }

    private static class JobOrderMapper {
        JobOrderResponse toResponse(com.washalert.washalertbackend.orders.JobOrder jo) {
            return new JobOrderResponse(
                    jo.getId(),
                    jo.getTrackingNumber(),
                    jo.getCustomerName(),
                    jo.getBranch(),
                    jo.getStatus(),
                    jo.getCreatedAt(),
                    jo.getUpdatedAt(),
                    jo.getServiceType(),
                    jo.getBookingDate(),
                    jo.getSlotStartTime(),
                    jo.getSlotEndTime(),
                    jo.getDetergentPreference(),
                    jo.getFabricConditionerPreference(),
                    jo.getLoadSize(),
                    jo.getEstimatedWeightKg(),
                    jo.getSpecialInstructions(),
                    jo.getCustomerPhone(),
                    jo.getCustomerEmail(),
                    jo.getDeliveryAddress(),
                    jo.getServicePrice(),
                    jo.getSuppliesPrice(),
                    jo.getDeliveryPrice(),
                    jo.getTotalPrice(),
                    jo.isPaid(),
                    jo.getPaymentMethod(),
                    jo.isPaid() ? PaymentStatus.PAID : null,
                    jo.getDeliveryLatitude(),
                    jo.getDeliveryLongitude(),
                    jo.getDeliveryUnitFloor(),
                    jo.getDeliveryContactName(),
                    jo.getDeliveryContactPhone(),
                    jo.getBranchLatitude(),
                    jo.getBranchLongitude()
            );
        }
    }
}
