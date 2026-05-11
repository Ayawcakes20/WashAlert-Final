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
 * CsrfFilter runs before this filter and always calls requestHandler.handle()
 * to set the CsrfToken attribute, even for safe methods. This filter accesses
 * the attribute immediately (before filterChain.doFilter()) to trigger the
 * deferred token initialization and force the cookie to be written to the
 * response before any subsequent processing.
 */
public class CsrfCookieFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // CsrfFilter has already run and set the deferred token as a request attribute.
        // Access it here to force the lazy initialization and cookie write.
        CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (csrfToken == null) {
            // Fallback: some Spring Security versions store it under "_csrf"
            csrfToken = (CsrfToken) request.getAttribute("_csrf");
        }
        if (csrfToken != null) {
            // Accessing the token forces CookieCsrfTokenRepository to write the cookie
            // to the response before filterChain.doFilter() is called, ensuring the
            // Set-Cookie header is included in this response.
            csrfToken.getToken();
        }
        filterChain.doFilter(request, response);
    }
}
