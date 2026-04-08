package com.washalert.washalertbackend.orders;

public class OrderNotFoundException extends IllegalArgumentException {
    public OrderNotFoundException(String message) {
        super(message);
    }
}
