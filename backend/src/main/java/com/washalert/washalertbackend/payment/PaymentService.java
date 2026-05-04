package com.washalert.washalertbackend.payment;

import java.math.BigDecimal;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.JobOrderTimelineService;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.payment.dto.PaymentResponse;
import com.washalert.washalertbackend.payment.dto.SubmitPaymentProofRequest;
import com.washalert.washalertbackend.payment.dto.VerifyPaymentRequest;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRecordRepository paymentRepository;
    private final JobOrderRepository orderRepository;
    private final NotificationService notificationService;
    private final PaymongoService paymongoService;
    private final JobOrderTimelineService timelineService;
    private final FirestoreSyncService firestoreSyncService;

    public PaymentService(
            PaymentRecordRepository paymentRepository,
            JobOrderRepository orderRepository,
            NotificationService notificationService,
            PaymongoService paymongoService,
            JobOrderTimelineService timelineService,
            FirestoreSyncService firestoreSyncService
    ) {
        this.paymentRepository = paymentRepository;
        this.orderRepository = orderRepository;
        this.notificationService = notificationService;
        this.paymongoService = paymongoService;
        this.timelineService = timelineService;
        this.firestoreSyncService = firestoreSyncService;
    }

    @Transactional
    public PaymentResponse submitProof(SubmitPaymentProofRequest req) {
        String tracking = normalizeTracking(req.trackingNumber());

        JobOrder order = orderRepository.findByTrackingNumber(tracking)
                .orElseThrow(() -> new IllegalArgumentException("Order not found for tracking number."));

        PaymentRecord payment = paymentRepository.findByJobOrder_TrackingNumber(tracking)
                .orElseGet(() -> PaymentRecord.builder().jobOrder(order).build());
        if (payment.getStatus() == PaymentStatus.VERIFIED || payment.getStatus() == PaymentStatus.PAID) {
            throw new IllegalStateException("Payment is already verified/paid and cannot be replaced.");
        }

        payment.setMethod(req.method());
        payment.setAmount(req.amount());
        payment.setReferenceNumber(req.referenceNumber().trim());
        payment.setProofUrl(req.proofUrl().trim());
        payment.setStatus(PaymentStatus.PENDING);
        payment.setVerifiedAt(null);
        payment.setVerifiedBy(null);
        payment.setNotes(null);

        PaymentRecord saved = paymentRepository.save(payment);
        notificationService.enqueueEmail(
                saved.getJobOrder().getCustomerEmail(),
                "WashAlert Payment Proof Received",
                "Tracking Number: %s\nWe received your payment proof and it is now pending verification."
                        .formatted(saved.getJobOrder().getTrackingNumber()),
                "PAYMENT",
                String.valueOf(saved.getId())
        );
        notificationService.enqueuePushToUserEmail(
                saved.getJobOrder().getCustomerEmail(),
                "Payment Proof Received",
                "Payment proof for order %s is pending verification."
                        .formatted(saved.getJobOrder().getTrackingNumber()),
                "PAYMENT_PENDING",
                saved.getJobOrder().getTrackingNumber() + ":pending"
        );
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PaymentResponse trackByTrackingNumber(String trackingNumber) {
        String tracking = normalizeTracking(trackingNumber);
        return paymentRepository.findByTrackingNumberWithJobOrder(tracking)
                .map(this::toResponse)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> list(String branch, AuthUserDetails principal) {
        User actor = principal.getUser();

        if (actor.getRole() == Role.STAFF) {
            return paymentRepository.findByBranchWithJobOrderOrderBySubmittedAtDesc(actor.getBranch())
                    .stream()
                    .map(this::toResponse)
                    .toList();
        }

        if (branch == null || branch.isBlank() || branch.equalsIgnoreCase("All")) {
            return paymentRepository.findAllWithJobOrderOrderBySubmittedAtDesc().stream().map(this::toResponse).toList();
        }

        return paymentRepository.findByBranchWithJobOrderOrderBySubmittedAtDesc(branch.trim())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PaymentResponse verify(Long paymentId, VerifyPaymentRequest req, AuthUserDetails principal) {
        User actor = principal.getUser();

        PaymentRecord payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment record not found."));

        if (actor.getRole() == Role.STAFF && !sameBranch(actor.getBranch(), payment.getJobOrder().getBranch())) {
            throw new IllegalArgumentException("You can only verify payments in your branch.");
        }
        
        // Allow verification of PAID payments (from GCash webhook) as well as PENDING
        if (payment.getStatus() != PaymentStatus.PENDING && payment.getStatus() != PaymentStatus.PAID) {
            throw new IllegalStateException("Only pending or paid payments can be verified.");
        }

        payment.setStatus(Boolean.TRUE.equals(req.approved()) ? PaymentStatus.VERIFIED : PaymentStatus.REJECTED);
        payment.setVerifiedAt(LocalDateTime.now());
        payment.setVerifiedBy(actor.getEmail());
        payment.setNotes(blankToNull(req.notes()));

        if (Boolean.TRUE.equals(req.approved())) {
            payment.getJobOrder().setPaid(true);
        }

        PaymentRecord saved = paymentRepository.save(payment);
        JobOrder savedOrder = orderRepository.save(saved.getJobOrder());
        firestoreSyncService.upsert(
                "orders",
                savedOrder.getTrackingNumber(),
                JobOrderResponse.from(savedOrder, saved.getStatus())
        );
        notificationService.enqueueEmail(
                saved.getJobOrder().getCustomerEmail(),
                "WashAlert Payment Update",
                "Tracking Number: %s\nPayment status: %s"
                        .formatted(saved.getJobOrder().getTrackingNumber(), saved.getStatus()),
                "PAYMENT_STATUS",
                String.valueOf(saved.getId())
        );
        String paymentBody = Boolean.TRUE.equals(req.approved())
                ? "Payment confirmed for order %s."
                .formatted(saved.getJobOrder().getTrackingNumber())
                : "Payment for order %s was rejected. Please review and resubmit."
                .formatted(saved.getJobOrder().getTrackingNumber());
        String pushType = Boolean.TRUE.equals(req.approved()) ? "PAYMENT_VERIFIED" : "PAYMENT_STATUS";
        notificationService.enqueuePushToUserEmail(
                saved.getJobOrder().getCustomerEmail(),
                Boolean.TRUE.equals(req.approved()) ? "Payment Confirmed" : "Payment Rejected",
                paymentBody,
                pushType,
                saved.getJobOrder().getTrackingNumber() + ":" + saved.getStatus().name()
        );
        return toResponse(saved);
    }

    @Transactional
    public String initiateGcashCheckout(String trackingNumber) {
        String tracking = normalizeTracking(trackingNumber);
        log.info("[PAYMENT][GCASH] Initiating checkout request tracking={}", tracking);
        JobOrder order = orderRepository.findByTrackingNumber(tracking)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found."));

        // Pre-create or update payment record as PENDING
        PaymentRecord payment = paymentRepository.findByJobOrder_TrackingNumber(tracking)
                .orElseGet(() -> PaymentRecord.builder().jobOrder(order).build());
        
        if (payment.getStatus() == PaymentStatus.PAID || payment.getStatus() == PaymentStatus.VERIFIED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is already paid.");
        }

        payment.setMethod(PaymentMethod.GCASH);
        
        // Resolve amount with fallback chain (totalPrice -> finalPrice -> servicePrice)
        BigDecimal resolvedAmount = order.getTotalPrice();
        if (resolvedAmount == null || resolvedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            resolvedAmount = order.getFinalPrice();
        }
        if (resolvedAmount == null || resolvedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            resolvedAmount = order.getServicePrice();
        }
        
        if (resolvedAmount == null || resolvedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order price is not set yet.");
        }

        payment.setAmount(resolvedAmount);
        payment.setStatus(PaymentStatus.PENDING);
        paymentRepository.save(payment);

        String checkoutUrl;
        try {
            checkoutUrl = paymongoService.createCheckoutSession(order);
        } catch (IllegalStateException ex) {
            log.error("[PAYMENT][GCASH] PayMongo configuration or validation error tracking={}: {}", tracking, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        } catch (Exception ex) {
            log.error("[PAYMENT][GCASH] Unexpected PayMongo error tracking={}: {}", tracking, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to generate GCash checkout URL. Please try again later.");
        }

        if (checkoutUrl == null || checkoutUrl.isBlank()) {
            log.error("[PAYMENT][GCASH] PayMongo returned empty checkout URL tracking={}", tracking);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to generate GCash checkout URL.");
        }
        log.info("CHECKOUT URL GENERATED: {}", checkoutUrl);
        /* 
        // Logic removed to follow the new 'Staff-Gated' workflow. 
        // Payment doesn't automatically start washing; staff must still verify weight/price.
        if (order.getStatus() == JobOrderStatus.PENDING) {
            order.setStatus(JobOrderStatus.WASHING);
            orderRepository.save(order);
            timelineService.log(order, order.getStatus(), "system", "GCash checkout initiated");
        }
        */
        return checkoutUrl;
    }

    private PaymentResponse toResponse(PaymentRecord p) {
        String tracking = p.getJobOrder() != null ? p.getJobOrder().getTrackingNumber() : "N/A";
        String branch = p.getJobOrder() != null ? p.getJobOrder().getBranch() : "N/A";
        return new PaymentResponse(
                p.getId(),
                tracking,
                branch,
                p.getMethod(),
                p.getAmount(),
                p.getReferenceNumber(),
                p.getProofUrl(),
                p.getStatus(),
                p.getSubmittedAt(),
                p.getVerifiedAt(),
                p.getVerifiedBy(),
                p.getNotes()
        );
    }

    private String normalizeTracking(String tracking) {
        if (tracking == null || tracking.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tracking number is required.");
        }
        return tracking.trim().toUpperCase();
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean sameBranch(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
    }
}
