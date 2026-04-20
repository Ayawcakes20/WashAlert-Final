package com.washalert.washalertbackend;

import com.washalert.washalertbackend.auth.PasswordResetProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(PasswordResetProperties.class)
public class WashalertBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(WashalertBackendApplication.class, args);
    }
}
