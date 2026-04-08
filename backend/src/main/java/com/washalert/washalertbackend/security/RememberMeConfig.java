package com.washalert.washalertbackend.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;

@Configuration
public class RememberMeConfig {

    @Bean
    public PersistentTokenBasedRememberMeServices rememberMeServices(
            PersistentTokenRepository tokenRepository,
            UserDetailsService userDetailsService
    ) {
        PersistentTokenBasedRememberMeServices svc =
                new PersistentTokenBasedRememberMeServices(
                        "washalert-remember-me-key-change-this",
                        userDetailsService,
                        tokenRepository
                );

        svc.setTokenValiditySeconds(60 * 60 * 24 * 14); // 14 days
        svc.setAlwaysRemember(false); // only if client requests
        svc.setCookieName("remember-me");
        svc.setUseSecureCookie(false); // set true when HTTPS

        // Optional (helps consistency):
        svc.setParameter("remember-me"); // checkbox param name (default is "remember-me")
        return svc;
    }
}
