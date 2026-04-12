package com.washalert.washalertbackend.payment;

import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.payment.dto.PaymentResponse;
import com.washalert.washalertbackend.payment.dto.SubmitPaymentProofRequest;
import com.washalert.washalertbackend.payment.dto.VerifyPaymentRequest;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PaymentService {

    private final PaymentRecordRepository paymentRepository;
    private final JobOrderRepository orderRepository;
    private final NotificationService notificationService;
    private final PaymongoService paymongoService;

    public PaymentService(
            PaymentRecordRepository paymentRepository,
            JobOrderRepository orderRepository,
            NotificationService notificationService,
            PaymongoService paymongoService
    ) {
        this.paymentRepository = paymentRepository;
        this.orderRepository = orderRepository;
        this.notificationService = notificationService;
        this.paymongoService = paymongoService;
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
        return toResponse(saved);
    }

    public PaymentResponse trackByTrackingNumber(String trackingNumber) {
        String tracking = normalizeTracking(trackingNumber);
        PaymentRecord payment = paymentRepository.findByJobOrder_TrackingNumber(tracking)
                .orElseThrow(() -> new IllegalArgumentException("Payment record not found."));
        return toResponse(payment);
    }

    public List<PaymentResponse> list(String branch, AuthUserDetails principal) {
        User actor = principal.getUser();

        if (actor.getRole() == Role.STAFF) {
            return paymentRepository.findByJobOrder_BranchIgnoreCaseOrderBySubmittedAtDesc(actor.getBranch())
                    .stream()
                    .map(this::toResponse)
                    .toList();
        }

        if (branch == null || branch.isBlank() || branch.equalsIgnoreCase("All")) {
            return paymentRepository.findAllByOrderBySubmittedAtDesc().stream().map(this::toResponse).toList();
        }

        return paymentRepository.findByJobOrder_BranchIgnoreCaseOrderBySubmittedAtDesc(branch.trim())
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
        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new IllegalStateException("Only pending payments can be verified.");
        }

        payment.setStatus(Boolean.TRUE.equals(req.approved()) ? PaymentStatus.VERIFIED : PaymentStatus.REJECTED);
        payment.setVerifiedAt(LocalDateTime.now());
        payment.setVerifiedBy(actor.getEmail());
        payment.setNotes(blankToNull(req.notes()));

        if (Boolean.TRUE.equals(req.approved())) {
            payment.getJobOrder().setPaid(true);
        }

        PaymentRecord saved = paymentRepository.save(payment);
        orderRepository.save(saved.getJobOrder());
        notificationService.enqueueEmail(
                saved.getJobOrder().getCustomerEmail(),
                "WashAlert Payment Update",
                "Tracking Number: %s\nPayment status: %s"
                        .formatted(saved.getJobOrder().getTrackingNumber(), saved.getStatus()),
                "PAYMENT_STATUS",
                String.valueOf(saved.getId())
        );
        return toResponse(saved);
    }

    @Transactional
    public String initiateGcashCheckout(String trackingNumber) {
        String tracking = normalizeTracking(trackingNumber);
        JobOrder order = orderRepository.findByTrackingNumber(tracking)
                .orElseThrow(() -> new IllegalArgumentException("Order not found."));

        // Pre-create or update payment record as PENDING
        PaymentRecord payment = paymentRepository.findByJobOrder_TrackingNumber(tracking)
                .orElseGet(() -> PaymentRecord.builder().jobOrder(order).build());
        
        if (payment.getStatus() == PaymentStatus.PAID || payment.getStatus() == PaymentStatus.VERIFIED) {
            throw new IllegalStateException("Order is already paid.");
        }

        payment.setMethod(PaymentMethod.GCASH);
        payment.setAmount(order.getTotalPrice());
        payment.setStatus(PaymentStatus.PENDING);
        paymentRepository.save(payment);

        return paymongoService.createCheckoutSession(order);
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
            throw new IllegalArgumentException("Tracking number is required.");
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
