package com.washalert.washalertbackend.orders;

public enum LaundryType {
    CLOTHES("Clothes"),
    BLANKETS("Blankets"),
    JEANS("Jeans"),
    COTTON("Cotton"),
    BEDSHEETS("Bedsheets"),
    MIXED("Mixed");

    private final String displayName;

    LaundryType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static LaundryType fromDisplayName(String name) {
        if (name == null) return null;
        for (LaundryType t : values()) {
            if (t.displayName.equalsIgnoreCase(name.trim())) return t;
        }
        return null;
    }
}
