package com.washalert.washalertbackend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Forces the deferred CSRF token to be loaded and the XSRF-TOKEN cookie to be
 * written on every response, including GET requests.
 *
 * Spring Security 6's CsrfTokenRequestAttributeHandler uses lazy loading:
 * the cookie is only written when the token is first accessed. For safe methods
 * (GET/HEAD/OPTIONS) the filter skips CSRF validation, so the cookie is never
 * written. This means the first mutating request from a new session has no
 * cookie to read, causing a 403. Accessing csrfToken.getToken() here forces
 * the cookie to be set on every response.
 */
public class CsrfCookieFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (csrfToken != null) {
            // Accessing the token forces CookieCsrfTokenRepository to write the cookie
            csrfToken.getToken();
        }
        filterChain.doFilter(request, response);
    }
}
