package com.washalert.washalertbackend.orders;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
<<<<<<< HEAD

@Converter(autoApply = false)
public class JobOrderStatusConverter implements AttributeConverter<JobOrderStatus, String> {

    private static final Logger log = LoggerFactory.getLogger(JobOrderStatusConverter.class);

    @Override
    public String convertToDatabaseColumn(JobOrderStatus attribute) {
        if (attribute == null) {
            return JobOrderStatus.PENDING.name();
        }
        return attribute.name();
    }

    @Override
    public JobOrderStatus convertToEntityAttribute(String dbData) {
        JobOrderStatus parsed = JobOrderStatus.fromValueOrFallback(dbData, null);
        if (parsed != null) {
            return parsed;
        }
        log.warn("[ORDER] Unknown status '{}' from DB. Falling back to PENDING.", dbData);
        return JobOrderStatus.PENDING;
    }
}
