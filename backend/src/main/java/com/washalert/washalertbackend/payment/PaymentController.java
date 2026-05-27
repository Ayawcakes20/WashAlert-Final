package com.washalert.washalertbackend.payment;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
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

    @PostMapping("/validate")
    public java.util.Map<String, Object> validateReceipt(@RequestBody java.util.Map<String, String> body) {
        String proofUrl = body.get("proofUrl");
        if (proofUrl == null || proofUrl.isBlank()) {
            throw new IllegalArgumentException("Proof URL is required.");
        }
        com.washalert.washalertbackend.support.GeminiChatClient.ReceiptValidationResult result = paymentService.validateGcashReceipt(proofUrl);
        if (!result.valid()) {
            throw new IllegalArgumentException("The uploaded photo does not appear to be a valid GCash receipt. Please upload a screenshot of your successful GCash transaction.");
        }
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("valid", true);
        response.put("referenceNumber", result.referenceNumber());
        return response;
    }

    @PostMapping("/checkout/gcash/{trackingNumber}")
    public GcashCheckoutResponse initiateGcashCheckout(@PathVariable String trackingNumber) {
        // ResponseStatusException from the service propagates naturally — no wrapper needed.
        // A catch-all here would re-wrap meaningful 400/502 errors into 500.
        String url = paymentService.initiateGcashCheckout(trackingNumber);
        if (url == null || url.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "PayMongo returned an empty checkout URL. Please try again.");
        }
        return new GcashCheckoutResponse(url);
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
