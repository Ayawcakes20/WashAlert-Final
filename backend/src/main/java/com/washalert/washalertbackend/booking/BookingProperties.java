package com.washalert.washalertbackend.booking;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "washalert.booking")
public class BookingProperties {

    private int openHour = 8;
    private int closeHour = 20;
    private int slotMinutes = 90;

    public int getOpenHour() {
        return openHour;
    }

    public void setOpenHour(int openHour) {
        this.openHour = openHour;
    }

    public int getCloseHour() {
        return closeHour;
    }

    public void setCloseHour(int closeHour) {
        this.closeHour = closeHour;
    }

    public int getSlotMinutes() {
        return slotMinutes;
    }

    public void setSlotMinutes(int slotMinutes) {
        this.slotMinutes = slotMinutes;
    }
}
