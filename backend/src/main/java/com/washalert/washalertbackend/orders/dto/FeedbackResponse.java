package com.washalert.washalertbackend.orders.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class FeedbackResponse {
    String trackingNumber;
    Integer customerRating;
    String customerComment;
    String feedbackSubmittedAt;
    String staffNote;
    String staffNoteUpdatedAt;
}
