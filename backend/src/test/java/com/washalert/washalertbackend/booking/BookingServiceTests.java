package com.washalert.washalertbackend.booking;

import com.washalert.washalertbackend.delivery.DeliveryOrderRepository;
import com.washalert.washalertbackend.machines.Machine;
import com.washalert.washalertbackend.machines.MachineRepository;
import com.washalert.washalertbackend.machines.MachineStatus;
import com.washalert.washalertbackend.machines.MachineType;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.JobOrderTimelineService;
import com.washalert.washalertbackend.orders.LoadSize;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.booking.dto.CreateBookingRequest;
import com.washalert.washalertbackend.inventory.InventoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BookingServiceTests {

    private JobOrderRepository jobOrderRepository;
    private MachineRepository machineRepository;
    private DeliveryOrderRepository deliveryOrderRepository;
    private JobOrderTimelineService timelineService;
    private NotificationService notificationService;
    private PricingService pricingService;
    private BookingService bookingService;

    @BeforeEach
    void setUp() {
        jobOrderRepository = mock(JobOrderRepository.class);
        machineRepository = mock(MachineRepository.class);
        deliveryOrderRepository = mock(DeliveryOrderRepository.class);
        timelineService = mock(JobOrderTimelineService.class);
        notificationService = mock(NotificationService.class);
        pricingService = mock(PricingService.class);
        InventoryService inventoryService = mock(InventoryService.class);
        
        BookingProperties bookingProperties = new BookingProperties();
        bookingProperties.setOpenHour(7);
        bookingProperties.setCloseHour(22);
        bookingProperties.setSlotMinutes(90);

        bookingService = new BookingService(
                jobOrderRepository,
                machineRepository,
                bookingProperties,
                deliveryOrderRepository,
                timelineService,
                notificationService,
                pricingService,
                inventoryService
        );

        when(machineRepository.lockByBranch(any())).thenReturn(List.of(activeMachine()));
        when(jobOrderRepository.countByNormalizedBranchAndBookingDateAndSlotStartTime(any(), any(), any())).thenReturn(0L);
        when(pricingService.estimate(any(), any(), any(), anyBoolean(), any(), anyInt(), any(), anyInt(), any()))
                .thenReturn(new PricingService.PriceEstimation(
                        new BigDecimal("240.00"),
                        new BigDecimal("40.00"),
                        BigDecimal.ZERO,
                        new BigDecimal("280.00"),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        "None",
                        "None",
                        new BigDecimal("560.00"),
                        1
                ));
        when(jobOrderRepository.saveAndFlush(any(JobOrder.class))).thenAnswer(invocation -> {
            JobOrder order = invocation.getArgument(0);
            order.setId(17L);
            return order;
        });
        when(jobOrderRepository.save(any(JobOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));

        doNothing().when(timelineService).log(any(), any(), any(), any());
        doNothing().when(notificationService).enqueueEmail(any(), any(), any(), any(), any());
        doNothing().when(notificationService).enqueuePushToUserEmail(any(), any(), any(), any(), any());
        doNothing().when(notificationService).enqueuePushToRoles(any(), any(), any(), any(), any(), any());
    }

    @Test
    void createBookingDropOffSucceeds() {
        JobOrderResponse response = bookingService.createBooking(baseRequestBuilder()
                .serviceType(ServiceType.DROP_OFF)
                .deliveryAddress(null)
                .paymentMethod("GCASH")
                .build());

        assertThat(response.getId()).isEqualTo(17L);
        assertThat(response.getStatus()).isEqualTo(JobOrderStatus.PENDING);
        assertThat(response.getTrackingNumber()).isEqualTo("WA-10017");
        assertThat(response.getPaymentMethod()).isEqualTo("GCASH");
    }

    @Test
    void createBookingPickupDeliveryRequiresAddress() {
        assertThatThrownBy(() -> bookingService.createBooking(baseRequestBuilder()
                .serviceType(ServiceType.PICKUP_DELIVERY)
                .deliveryAddress("   ")
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Delivery address is required for pickup and delivery.");
    }

    @Test
    void createBookingNormalizesCodToCash() {
        JobOrderResponse response = bookingService.createBooking(baseRequestBuilder()
                .paymentMethod("cod")
                .build());

        assertThat(response.getPaymentMethod()).isEqualTo("CASH");
    }

    @Test
    void createBookingRejectsInvalidPaymentMethod() {
        assertThatThrownBy(() -> bookingService.createBooking(baseRequestBuilder()
                .paymentMethod("CARD")
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid payment method. Allowed values: GCASH, CASH, MAYA.");
    }

    @Test
    void createBookingRejectsBelowMinimumWeight() {
        assertThatThrownBy(() -> bookingService.createBooking(baseRequestBuilder()
                .estimatedWeightKg(new BigDecimal("4.0"))
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Minimum load is 5 kg.");
    }

    @Test
    void createBookingRejectsServiceSpecificMaxWeight() {
        assertThatThrownBy(() -> bookingService.createBooking(baseRequestBuilder()
                .serviceName("Ecowash Full Service (5kg)")
                .estimatedWeightKg(new BigDecimal("6.0"))
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Selected service allows up to 5 kg per load.");
    }

    private CreateBookingRequestBuilder baseRequestBuilder() {
        return new CreateBookingRequestBuilder()
                .customerName("Customer One")
                .branch("Makati Branch")
                .branchId(1L)
                .customerPhone("09171234567")
                .customerEmail("customer@example.com")
                .serviceType(ServiceType.DROP_OFF)
                .preferredDate(LocalDate.now().plusDays(1))
                .preferredSlotStartTime(LocalTime.of(9, 0))
                .detergentPreference("Surf detergent")
                .fabricConditionerPreference("Charm fabcon")
                .loadSize(LoadSize.MEDIUM)
                .estimatedWeightKg(new BigDecimal("7.0"))
                .containsBulkyItems(false)
                .specialInstructions("Handle with care")
                .deliveryAddress(null)
                .serviceName("Basic Full Service (7kg)")
                .isRush(false)
                .distanceKm(BigDecimal.ZERO)
                .paymentMethod("GCASH")
                .deliveryLatitude(null)
                .deliveryLongitude(null)
                .deliveryUnitFloor(null)
                .deliveryContactName(null)
                .deliveryContactPhone(null)
                .branchLatitude(14.5597)
                .branchLongitude(121.0179);
    }

    private Machine activeMachine() {
        return Machine.builder()
                .id(1L)
                .machineId("L-W-01")
                .branch("Makati Branch")
                .type(MachineType.WASHER)
                .status(MachineStatus.AVAILABLE)
                .build();
    }

    private static class CreateBookingRequestBuilder {
        private String customerName;
        private String branch;
        private Long branchId;
        private String customerPhone;
        private String customerEmail;
        private ServiceType serviceType;
        private LocalDate preferredDate;
        private LocalTime preferredSlotStartTime;
        private String detergentPreference;
        private String fabricConditionerPreference;
        private LoadSize loadSize;
        private BigDecimal estimatedWeightKg;
        private boolean containsBulkyItems;
        private String specialInstructions;
        private String deliveryAddress;
        private String serviceName;
        private boolean isRush;
        private BigDecimal distanceKm;
        private String paymentMethod;
        private Double deliveryLatitude;
        private Double deliveryLongitude;
        private String deliveryUnitFloor;
        private String deliveryContactName;
        private String deliveryContactPhone;
        private Double branchLatitude;
        private Double branchLongitude;

        private CreateBookingRequestBuilder customerName(String value) { this.customerName = value; return this; }
        private CreateBookingRequestBuilder branch(String value) { this.branch = value; return this; }
        private CreateBookingRequestBuilder branchId(Long value) { this.branchId = value; return this; }
        private CreateBookingRequestBuilder customerPhone(String value) { this.customerPhone = value; return this; }
        private CreateBookingRequestBuilder customerEmail(String value) { this.customerEmail = value; return this; }
        private CreateBookingRequestBuilder serviceType(ServiceType value) { this.serviceType = value; return this; }
        private CreateBookingRequestBuilder preferredDate(LocalDate value) { this.preferredDate = value; return this; }
        private CreateBookingRequestBuilder preferredSlotStartTime(LocalTime value) { this.preferredSlotStartTime = value; return this; }
        private CreateBookingRequestBuilder detergentPreference(String value) { this.detergentPreference = value; return this; }
        private CreateBookingRequestBuilder fabricConditionerPreference(String value) { this.fabricConditionerPreference = value; return this; }
        private CreateBookingRequestBuilder loadSize(LoadSize value) { this.loadSize = value; return this; }
        private CreateBookingRequestBuilder estimatedWeightKg(BigDecimal value) { this.estimatedWeightKg = value; return this; }
        private CreateBookingRequestBuilder containsBulkyItems(boolean value) { this.containsBulkyItems = value; return this; }
        private CreateBookingRequestBuilder specialInstructions(String value) { this.specialInstructions = value; return this; }
        private CreateBookingRequestBuilder deliveryAddress(String value) { this.deliveryAddress = value; return this; }
        private CreateBookingRequestBuilder serviceName(String value) { this.serviceName = value; return this; }
        private CreateBookingRequestBuilder isRush(boolean value) { this.isRush = value; return this; }
        private CreateBookingRequestBuilder distanceKm(BigDecimal value) { this.distanceKm = value; return this; }
        private CreateBookingRequestBuilder paymentMethod(String value) { this.paymentMethod = value; return this; }
        private CreateBookingRequestBuilder deliveryLatitude(Double value) { this.deliveryLatitude = value; return this; }
        private CreateBookingRequestBuilder deliveryLongitude(Double value) { this.deliveryLongitude = value; return this; }
        private CreateBookingRequestBuilder deliveryUnitFloor(String value) { this.deliveryUnitFloor = value; return this; }
        private CreateBookingRequestBuilder deliveryContactName(String value) { this.deliveryContactName = value; return this; }
        private CreateBookingRequestBuilder deliveryContactPhone(String value) { this.deliveryContactPhone = value; return this; }
        private CreateBookingRequestBuilder branchLatitude(Double value) { this.branchLatitude = value; return this; }
        private CreateBookingRequestBuilder branchLongitude(Double value) { this.branchLongitude = value; return this; }

        private CreateBookingRequest build() {
            return new CreateBookingRequest(
                    customerName,
                    branch,
                    branchId,
                    customerPhone,
                    customerEmail,
                    serviceType,
                    preferredDate,
                    preferredSlotStartTime,
                    detergentPreference,
                    null,
                    fabricConditionerPreference,
                    null,
                    loadSize,
                    estimatedWeightKg,
                    containsBulkyItems,
                    specialInstructions,
                    deliveryAddress,
                    serviceName,
                    isRush,
                    distanceKm,
                    paymentMethod,
                    deliveryLatitude,
                    deliveryLongitude,
                    deliveryUnitFloor,
                    deliveryContactName,
                    deliveryContactPhone,
                    branchLatitude,
                    branchLongitude,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    null
            );
        }
    }
}
