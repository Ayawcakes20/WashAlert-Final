package com.washalert.washalertbackend.orders;

import org.springframework.stereotype.Service;

@Service
public class JobOrderTimelineService {

    private final JobOrderStatusHistoryRepository historyRepository;

    public JobOrderTimelineService(JobOrderStatusHistoryRepository historyRepository) {
        this.historyRepository = historyRepository;
    }

    public void log(JobOrder jobOrder, JobOrderStatus status, String changedBy, String notes) {
        JobOrderStatusHistory history = JobOrderStatusHistory.builder()
                .jobOrder(jobOrder)
                .status(status)
                .changedBy(blankToNull(changedBy))
                .notes(blankToNull(notes))
                .build();
        historyRepository.save(history);
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
