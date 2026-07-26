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
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    // CSP appropriate for a REST API server — restricts browser from loading any
    // sub-resources from API responses; frame-ancestors prevents clickjacking.
    private static final String CSP_POLICY =
            "default-src 'none'; frame-ancestors 'none'; form-action 'self';";

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
        HttpSessionCsrfTokenRepository csrfRepo = new HttpSessionCsrfTokenRepository();
        csrfRepo.setHeaderName("X-XSRF-TOKEN");
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();

        http
                .cors(Customizer.withDefaults())

                // ── Security headers ────────────────────────────────────────────────
                .headers(headers -> headers
                        // Prevent clickjacking
                        .frameOptions(frame -> frame.deny())
                        // Prevent MIME-type sniffing
                        .contentTypeOptions(Customizer.withDefaults())
                        // HSTS — only sent on HTTPS; Spring Security skips on plain HTTP
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31_536_000) // 1 year
                                .preload(false)
                        )
                        // CSP
                        .contentSecurityPolicy(csp -> csp.policyDirectives(CSP_POLICY))
                        // Referrer-Policy — don't leak path info across origins
                        .referrerPolicy(rp -> rp.policy(
                                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                )

                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfRepo)
                        .csrfTokenRequestHandler(csrfHandler)
                        // Webhooks use HMAC signature verification — exempt from CSRF
                        .ignoringRequestMatchers(
                                "/api/payments/webhook",
                                "/api/payments/paymongo/webhook",
                                // Mobile and auth endpoints rely on Bearer tokens, not cookies
                                "/api/auth/**",
                                "/api/bookings",
                                "/api/bookings/check-supplies",
                                "/api/payments/checkout/**",
                                "/api/payments/proof",
                                "/api/payments/validate",
                                "/api/support/chat",
                                "/api/orders/**",
                                "/api/deliveries/**",
                                // Mobile profile endpoints use Bearer token auth, not session cookies
                                "/api/user/profile",
                                "/api/user/profile/**",
                                "/oauth2/**",
                                "/login/oauth2/**"
                        )
                )

                // Session timeout is configured via server.servlet.session.timeout in yaml.
                // maximumSessions(3) prevents unlimited concurrent sessions per account.
                .sessionManagement(sm -> sm
                        .sessionCreationPolicy(SessionCreationPolicy.ALWAYS)
                        .maximumSessions(3)
                        .maxSessionsPreventsLogin(false)
                )

                .securityContext(sc -> sc.requireExplicitSave(false))
                // Force CSRF cookie to be written on every response (including GET requests)
                .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class)
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
                        .requestMatchers("/api/auth/firebase-login-otp/**").permitAll()

                        .requestMatchers(HttpMethod.POST,
                                "/api/auth/register",
                                "/api/auth/login",
                                "/api/auth/firebase/direct-login",
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
                                "/api/bookings/check-supplies",
                                "/api/payments/webhook",
                                "/api/payments/checkout/**",
                                "/api/payments/paymongo/webhook")
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/bookings/slots").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/bookings/supplies-availability").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/orders/track/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/payments/track/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/deliveries/track/**").permitAll()
                        // Support chat/history was previously public. It is only ever called from
                        // logged-in areas of the app — the mobile Customer/Driver chat screens, and
                        // the web Staff/Admin IkotAsk AI assistant + Support Tickets viewer (which
                        // reads ticket conversation history via this same endpoint) — never from a
                        // pre-login screen. Being public let anyone pull order/payment/delivery data,
                        // including the delivery confirmationCode, by typing a tracking number into
                        // the chat box.
                        .requestMatchers(HttpMethod.POST, "/api/support/chat").hasAnyRole("CUSTOMER", "DRIVER", "ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/support/history").hasAnyRole("CUSTOMER", "DRIVER", "ADMIN", "STAFF")

                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout").authenticated()

                        // /api/payments/proof requires CUSTOMER authentication
                        .requestMatchers(HttpMethod.POST, "/api/payments/proof", "/api/payments/validate").hasRole("CUSTOMER")

                        .requestMatchers(HttpMethod.GET, "/api/admin/users/drivers").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/machines/**").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers("/api/inventory/**").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/orders/my/paged").hasRole("CUSTOMER")
                        .requestMatchers(HttpMethod.PUT, "/api/orders/*/confirm-price").hasRole("CUSTOMER")
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
        cfg.setExposedHeaders(List.of("X-XSRF-TOKEN"));
        cfg.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
