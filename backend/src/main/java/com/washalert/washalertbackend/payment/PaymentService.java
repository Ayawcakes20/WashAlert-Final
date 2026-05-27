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
import com.washalert.washalertbackend.support.GeminiChatClient;
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
    private final GeminiChatClient geminiChatClient;

    public PaymentService(
            PaymentRecordRepository paymentRepository,
            JobOrderRepository orderRepository,
            NotificationService notificationService,
            PaymongoService paymongoService,
            JobOrderTimelineService timelineService,
            FirestoreSyncService firestoreSyncService,
            GeminiChatClient geminiChatClient
    ) {
        this.paymentRepository = paymentRepository;
        this.orderRepository = orderRepository;
        this.notificationService = notificationService;
        this.paymongoService = paymongoService;
        this.timelineService = timelineService;
        this.firestoreSyncService = firestoreSyncService;
        this.geminiChatClient = geminiChatClient;
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

        if (req.method() == PaymentMethod.GCASH) {
            GeminiChatClient.ReceiptValidationResult validation = geminiChatClient.validateGcashReceipt(req.proofUrl().trim());
            if (!validation.valid()) {
                throw new IllegalArgumentException("The uploaded photo does not appear to be a valid GCash receipt. Please upload a screenshot of your successful GCash transaction.");
            }
            if (validation.referenceNumber() != null && !validation.referenceNumber().equals(req.referenceNumber().trim())) {
                throw new IllegalArgumentException("The Reference Number entered (" + req.referenceNumber() + ") does not match the Reference Number on the uploaded receipt (" + validation.referenceNumber() + ").");
            }
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

    @Transactional
    public PaymentResponse trackByTrackingNumber(String trackingNumber) {
        String tracking = normalizeTracking(trackingNumber);
        PaymentRecord record = paymentRepository.findByTrackingNumberWithJobOrder(tracking).orElse(null);
        if (record == null) {
            return null;
        }

        if (record.getStatus() == PaymentStatus.PENDING 
                && record.getMethod() == PaymentMethod.GCASH 
                && record.getReferenceNumber() != null 
                && !record.getReferenceNumber().isBlank()) {
            try {
                boolean isPaid = paymongoService.checkCheckoutSessionPaid(record.getReferenceNumber());
                if (isPaid) {
                    confirmPayment(record, record.getReferenceNumber(), "Paymongo Active Tracker");
                }
            } catch (Exception e) {
                log.error("[PAYMENT][GCASH] Failed to verify checkout session status for tracking={}", tracking, e);
            }
        }

        return toResponse(record);
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
        List<PaymentRecord> existingPayments = paymentRepository.findByJobOrder_TrackingNumberOrderBySubmittedAtDesc(tracking);
        PaymentRecord payment;
        
        if (!existingPayments.isEmpty()) {
            payment = existingPayments.get(0);
            if (existingPayments.size() > 1) {
                log.warn("[PAYMENT][GCASH] Found {} existing payment records for tracking={}, using the latest.", 
                        existingPayments.size(), tracking);
            }
        } else {
            payment = PaymentRecord.builder().jobOrder(order).build();
        }
        
        if (payment.getStatus() == PaymentStatus.PAID || payment.getStatus() == PaymentStatus.VERIFIED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order is already paid.");
        }

        payment.setMethod(PaymentMethod.GCASH);

        // Resolve amount: finalPrice (staff-confirmed) wins over totalPrice (estimated at booking).
        // Falls back to totalPrice if finalPrice is not yet set, then servicePrice as last resort.
        BigDecimal resolvedAmount = order.getFinalPrice();
        if (resolvedAmount == null || resolvedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            resolvedAmount = order.getTotalPrice();
        }
        if (resolvedAmount == null || resolvedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            resolvedAmount = order.getServicePrice();
        }
        
        if (resolvedAmount == null || resolvedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.error("[PAYMENT][GCASH] Order amount is zero or null for tracking={}", tracking);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order price is not set yet. Please wait for staff to confirm.");
        }

        payment.setAmount(resolvedAmount);
        payment.setStatus(PaymentStatus.PENDING);

        CheckoutSessionResult sessionResult;
        try {
            sessionResult = paymongoService.createCheckoutSession(order);
        } catch (IllegalStateException ex) {
            log.error("[PAYMENT][GCASH] PayMongo checkout error tracking={}: {}", tracking, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unable to start GCash checkout right now. Please try again or choose another payment option.");
        } catch (Exception ex) {
            log.error("[PAYMENT][GCASH] Unexpected PayMongo error tracking={}", tracking, ex);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Unable to start GCash checkout right now. Please try again or choose another payment option.");
        }

        if (sessionResult == null || sessionResult.checkoutUrl() == null || sessionResult.checkoutUrl().isBlank()) {
            log.error("[PAYMENT][GCASH] PayMongo returned empty checkout URL tracking={}", tracking);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to generate GCash checkout URL.");
        }
        log.info("CHECKOUT URL GENERATED: {}, SESSION ID: {}", sessionResult.checkoutUrl(), sessionResult.sessionId());
        
        payment.setReferenceNumber(sessionResult.sessionId());
        paymentRepository.save(payment);

        return sessionResult.checkoutUrl();
    }

    @Transactional
    public void confirmPayment(PaymentRecord record, String referenceNumber, String verifier) {
        if (record.getStatus() != PaymentStatus.PAID) {
            record.setStatus(PaymentStatus.PAID);
            record.setVerifiedAt(LocalDateTime.now());
            record.setVerifiedBy(verifier);
            if (referenceNumber != null && !referenceNumber.isBlank()) {
                record.setReferenceNumber(referenceNumber);
            }
            paymentRepository.save(record);

            JobOrder jobOrder = record.getJobOrder();
            jobOrder.setPaid(true);
            
            // Transition status to WASHING if price was confirmed
            if (jobOrder.getStatus() == JobOrderStatus.PRICE_CONFIRMED) {
                jobOrder.setStatus(JobOrderStatus.WASHING);
                timelineService.log(jobOrder, jobOrder.getStatus(), "system", 
                        "Payment confirmed via " + verifier + ". Order is now being processed.");
            } else {
                timelineService.log(jobOrder, jobOrder.getStatus(), "system", 
                        "Payment confirmed via " + verifier + ".");
            }
            
            orderRepository.save(jobOrder);
            
            // Sync to Firestore for real-time dashboard updates — blocking so customers see PAID immediately.
            JobOrderResponse response = JobOrderResponse.from(jobOrder, PaymentStatus.PAID);
            firestoreSyncService.upsertBlocking("orders", jobOrder.getTrackingNumber(), response);

            notificationService.enqueueEmail(
                    jobOrder.getCustomerEmail(),
                    "WashAlert Payment Received!",
                    "Your payment for order %s has been confirmed. We are now processing your laundry.".formatted(jobOrder.getTrackingNumber()),
                    "PAYMENT_PAID",
                    String.valueOf(record.getId())
            );
            notificationService.enqueuePushToUserEmail(
                    jobOrder.getCustomerEmail(),
                    "Payment Confirmed",
                    "Payment for order %s has been confirmed.".formatted(jobOrder.getTrackingNumber()),
                    "PAYMENT_PAID",
                    jobOrder.getTrackingNumber().toUpperCase() + ":paid"
            );
            notificationService.enqueuePushToRoles(
                    List.of(Role.STAFF, Role.ADMIN),
                    jobOrder.getBranch(),
                    "Payment Auto-Confirmed",
                    "GCash payment confirmed for order " + jobOrder.getTrackingNumber() + ". Ready to proceed.",
                    "PAYMENT_PAID",
                    jobOrder.getTrackingNumber().toUpperCase() + ":staff:paid"
            );
        }
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

    @Transactional(readOnly = true)
    public GeminiChatClient.ReceiptValidationResult validateGcashReceipt(String proofUrl) {
        if (proofUrl == null || proofUrl.isBlank()) {
            throw new IllegalArgumentException("Proof URL is required.");
        }
        return geminiChatClient.validateGcashReceipt(proofUrl.trim());
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
