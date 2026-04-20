package com.washalert.washalertbackend.notification;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "washalert.notification")
public class NotificationProperties {

    private int maxAttempts = 5;
    private int retryDelayMinutes = 2;
    private int processIntervalMs = 60000;

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public int getRetryDelayMinutes() {
        return retryDelayMinutes;
    }

    public void setRetryDelayMinutes(int retryDelayMinutes) {
        this.retryDelayMinutes = retryDelayMinutes;
    }

    public int getProcessIntervalMs() {
        return processIntervalMs;
    }

    public void setProcessIntervalMs(int processIntervalMs) {
        this.processIntervalMs = processIntervalMs;
    }
}
