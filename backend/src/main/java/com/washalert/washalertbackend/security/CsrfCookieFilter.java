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
 * Spring Security 6 uses lazy CSRF token loading: the token (and therefore the
 * cookie) is only written when CsrfToken.getToken() is explicitly accessed.
 * For safe methods (GET/HEAD/OPTIONS) the CsrfFilter skips validation and never
 * accesses the token, so the cookie is never written. This means the first
 * mutating request from a new session has no cookie to send, causing a 403.
 *
 * The cookie is written in a finally block AFTER filterChain.doFilter() so that
 * any session establishment or token refresh that occurs during request
 * processing is captured before the cookie value is committed to the response.
 */
public class CsrfCookieFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        try {
            filterChain.doFilter(request, response);
        } finally {
            // Trigger deferred token load after full request processing so
            // the cookie reflects the final session/token state.
            CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
            if (csrfToken == null) {
                // Fallback: some Spring Security versions store it under "_csrf"
                csrfToken = (CsrfToken) request.getAttribute("_csrf");
            }
            if (csrfToken != null && !response.isCommitted()) {
                csrfToken.getToken();
            }
        }
    }
}
