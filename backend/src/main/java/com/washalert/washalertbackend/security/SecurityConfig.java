package com.washalert.washalertbackend.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.RememberMeServices;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final RestAuthHandlers restAuthHandlers;
    private final RememberMeServices rememberMeServices;
    private final RateLimitFilter rateLimitFilter;
    private final String frontendBaseUrl;
    private final List<String> allowedOrigins;

    public SecurityConfig(
            RestAuthHandlers restAuthHandlers,
            RememberMeServices rememberMeServices,
            RateLimitFilter rateLimitFilter,
            @Value("${washalert.frontend-base-url:http://localhost:5173}") String frontendBaseUrl,
            @Value("${washalert.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String allowedOrigins) {
        this.restAuthHandlers = restAuthHandlers;
        this.rememberMeServices = rememberMeServices;
        this.rateLimitFilter = rateLimitFilter;
        this.frontendBaseUrl = frontendBaseUrl;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, GoogleOAuth2UserService googleOAuth2UserService)
            throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.ALWAYS))

                .securityContext(sc -> sc.requireExplicitSave(false))
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .rememberMe(rm -> rm.rememberMeServices(rememberMeServices))

                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(u -> u.userService(googleOAuth2UserService))
                        .failureHandler((req, res, ex) -> {
                            res.setStatus(HttpServletResponse.SC_FOUND);
                            res.sendRedirect(frontendBaseUrl + "/login?oauth=failed");
                        })
                        .successHandler((req, res, auth) -> {
                            res.setStatus(HttpServletResponse.SC_FOUND);
                            res.sendRedirect(frontendBaseUrl + "/app/dashboard");
                        }))

                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(restAuthHandlers)
                        .accessDeniedHandler(restAuthHandlers))

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                        .requestMatchers("/test").permitAll()
                        .requestMatchers("/api/auth/firebase-login-otp/**").permitAll()

                        .requestMatchers(HttpMethod.POST,
                                "/api/auth/register",
                                "/api/auth/login",
                                "/api/auth/firebase/complete-first-login-password",
                                "/api/auth/mobile/register-profile",
                                "/api/auth/complete-invitation",
                                "/api/auth/verify-email",
                                "/api/auth/resend-otp",
                                "/api/auth/forgot-password",
                                "/api/auth/reset-password",
                                "/api/auth/set-password",
                                "/api/auth/otp/**",
                                "/api/bookings",
                                "/api/payments/proof",
                                "/api/payments/webhook",
                                "/api/support/chat")
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/bookings/slots").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/orders/track/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/payments/track/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/deliveries/track/**").permitAll()

                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout").authenticated()

                        .requestMatchers(HttpMethod.GET, "/api/admin/users/drivers").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/machines/**").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.GET,  "/api/orders/my/paged").hasRole("CUSTOMER")
                        .requestMatchers(HttpMethod.POST, "/api/orders/*/confirm-price").hasRole("CUSTOMER")
                        .requestMatchers("/api/orders/**").hasAnyRole("ADMIN", "STAFF", "CUSTOMER", "DRIVER")
                        .requestMatchers("/api/deliveries/**").hasAnyRole("ADMIN", "STAFF", "DRIVER")
                        .anyRequest().authenticated()
                );

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(allowedOrigins);
        cfg.setAllowedMethods(List.of(
                "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
