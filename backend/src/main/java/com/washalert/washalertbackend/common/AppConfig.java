package com.washalert.washalertbackend.common;

import com.washalert.washalertbackend.auth.PasswordResetProperties;
import com.washalert.washalertbackend.auth.StaffInvitationProperties;
import com.washalert.washalertbackend.payment.PaymongoProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
@EnableConfigurationProperties({
        PasswordResetProperties.class,
        StaffInvitationProperties.class,
        DataReadProperties.class,
        PaymongoProperties.class
})
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
