package com.washalert.washalertbackend.common;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "washalert.data")
public class DataReadProperties {

    private DataReadMode readMode = DataReadMode.MYSQL;

    public DataReadMode getReadMode() {
        return readMode;
    }

    public void setReadMode(DataReadMode readMode) {
        this.readMode = (readMode == null) ? DataReadMode.MYSQL : readMode;
    }

    public boolean prefersFirestoreReads() {
        return readMode == DataReadMode.FIRESTORE || readMode == DataReadMode.HYBRID;
    }

    public boolean allowsMysqlFallback() {
        return readMode == DataReadMode.HYBRID;
    }
}
