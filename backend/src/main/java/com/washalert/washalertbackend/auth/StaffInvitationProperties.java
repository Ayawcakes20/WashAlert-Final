package com.washalert.washalertbackend.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "washalert.staff-invitation")
public class StaffInvitationProperties {

    private int ttlMinutes = 30;
    private int tokenBytes = 32;
    private String frontendBaseUrl = "https://www.washalert.com";
    private String setPasswordPath = "/set-password";
    private Cleanup cleanup = new Cleanup();

    public int getTtlMinutes() {
        return ttlMinutes;
    }

    public void setTtlMinutes(int ttlMinutes) {
        this.ttlMinutes = ttlMinutes;
    }

    public int getTokenBytes() {
        return tokenBytes;
    }

    public void setTokenBytes(int tokenBytes) {
        this.tokenBytes = tokenBytes;
    }

    public String getFrontendBaseUrl() {
        return frontendBaseUrl;
    }

    public void setFrontendBaseUrl(String frontendBaseUrl) {
        this.frontendBaseUrl = frontendBaseUrl;
    }

    public String getSetPasswordPath() {
        return setPasswordPath;
    }

    public void setSetPasswordPath(String setPasswordPath) {
        this.setPasswordPath = setPasswordPath;
    }

    public Cleanup getCleanup() {
        return cleanup;
    }

    public void setCleanup(Cleanup cleanup) {
        this.cleanup = cleanup;
    }

    public static class Cleanup {
        private boolean enabled = true;
        private String cron = "0 */30 * * * *";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getCron() {
            return cron;
        }

        public void setCron(String cron) {
            this.cron = cron;
        }
    }
}
