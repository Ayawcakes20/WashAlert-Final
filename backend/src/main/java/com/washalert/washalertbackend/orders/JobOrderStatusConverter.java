package com.washalert.washalertbackend.orders;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class JobOrderStatusConverter implements AttributeConverter<JobOrderStatus, String> {

    @Override
    public String convertToDatabaseColumn(JobOrderStatus attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public JobOrderStatus convertToEntityAttribute(String dbData) {
        return JobOrderStatus.fromJson(dbData);
    }
}
