package com.washalert.washalertbackend.security;

import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import com.washalert.washalertbackend.user.UserStatus;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

@Component
public class UserAccountStatusFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(UserAccountStatusFilter.class);

    private final UserRepository userRepository;
    private final RestAuthHandlers restAuthHandlers;

    public UserAccountStatusFilter(UserRepository userRepository, RestAuthHandlers restAuthHandlers) {
        this.userRepository = userRepository;
        this.restAuthHandlers = restAuthHandlers;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            Optional<User> userOpt = resolveUser(auth);

            if (userOpt.isPresent()) {
                User user = userOpt.get();

                if (user.getStatus() == UserStatus.DEACTIVATED || !user.isEnabled()) {
                    log.warn("[AUTH][DEACTIVATED] Revoking active session for deactivated user ID: {} email: {} on URI: {}",
                            user.getId(), user.getEmail(), request.getRequestURI());

                    // 1. Invalidate session immediately
                    HttpSession session = request.getSession(false);
                    if (session != null) {
                        try {
                            session.invalidate();
                        } catch (Exception ex) {
                            log.debug("Session already invalidated: {}", ex.getMessage());
                        }
                    }

                    // 2. Clear security context
                    SecurityContextHolder.clearContext();

                    // 3. Return 401 Unauthorized via RestAuthHandlers
                    restAuthHandlers.commence(
                            request,
                            response,
                            new DisabledException("Your account has been deactivated. Please contact admin.")
                    );
                    return;
                } else if (user.getStatus() == UserStatus.SUSPENDED) {
                    log.warn("[AUTH][SUSPENDED] Revoking active session for suspended user ID: {} email: {} on URI: {}",
                            user.getId(), user.getEmail(), request.getRequestURI());

                    HttpSession session = request.getSession(false);
                    if (session != null) {
                        try {
                            session.invalidate();
                        } catch (Exception ex) {
                            log.debug("Session already invalidated: {}", ex.getMessage());
                        }
                    }

                    SecurityContextHolder.clearContext();

                    restAuthHandlers.commence(
                            request,
                            response,
                            new DisabledException("Your account has been suspended. Please contact admin.")
                    );
                    return;
                } else {
                    // Refresh user reference in principal for downstream controllers
                    if (auth.getPrincipal() instanceof AuthUserDetails authUserDetails) {
                        authUserDetails.setUser(user);
                    }
                }
            } else {
                log.warn("[AUTH][NOT_FOUND] User record not found for principal {} on URI: {}",
                        auth.getName(), request.getRequestURI());

                HttpSession session = request.getSession(false);
                if (session != null) {
                    try {
                        session.invalidate();
                    } catch (Exception ignored) {}
                }
                SecurityContextHolder.clearContext();
                restAuthHandlers.commence(
                        request,
                        response,
                        new DisabledException("Account not found or has been removed.")
                );
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private Optional<User> resolveUser(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof AuthUserDetails authUserDetails && authUserDetails.getUser() != null) {
            Long userId = authUserDetails.getUser().getId();
            if (userId != null) {
                return userRepository.findById(userId);
            }
            return userRepository.findByEmail(authUserDetails.getUsername());
        }

        String name = auth.getName();
        if (name != null && !name.isBlank()) {
            return userRepository.findByEmail(name.trim().toLowerCase());
        }

        return Optional.empty();
    }
}
