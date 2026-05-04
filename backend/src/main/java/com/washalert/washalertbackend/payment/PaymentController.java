package com.washalert.washalertbackend.payment;

import com.washalert.washalertbackend.payment.dto.GcashCheckoutResponse;
import com.washalert.washalertbackend.payment.dto.PaymentResponse;
import com.washalert.washalertbackend.payment.dto.SubmitPaymentProofRequest;
import com.washalert.washalertbackend.payment.dto.VerifyPaymentRequest;
import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/proof")
    public PaymentResponse submitProof(@Valid @RequestBody SubmitPaymentProofRequest req) {
        return paymentService.submitProof(req);
    }

    @PostMapping("/checkout/gcash/{trackingNumber}")
    public GcashCheckoutResponse initiateGcashCheckout(@PathVariable String trackingNumber) {
        try {
            String url = paymentService.initiateGcashCheckout(trackingNumber);
            if (url == null || url.isEmpty()) {
                throw new IllegalStateException("PayMongo checkout URL is null or empty for tracking: " + trackingNumber);
            }
            return new GcashCheckoutResponse(url);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Payment Service Error: " + ex.getMessage());
        }
    }

    @GetMapping("/track/{trackingNumber}")
    public PaymentResponse track(@PathVariable String trackingNumber) {
        return paymentService.trackByTrackingNumber(trackingNumber);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<PaymentResponse> list(
            @RequestParam(required = false) String branch,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return paymentService.list(branch, principal);
    }

    @PutMapping("/{paymentId}/verify")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public PaymentResponse verify(
            @PathVariable Long paymentId,
            @Valid @RequestBody VerifyPaymentRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return paymentService.verify(paymentId, req, principal);
    }
}
