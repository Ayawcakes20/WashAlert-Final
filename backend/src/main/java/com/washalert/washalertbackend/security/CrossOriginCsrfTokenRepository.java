package com.washalert.washalertbackend.security;

import org.springframework.http.ResponseCookie;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.util.StringUtils;
import org.springframework.web.util.WebUtils;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.time.Duration;
import java.util.UUID;

/**
 * Implementation of CsrfTokenRepository that configures the CSRF cookie for
 * cross-origin deployments by setting SameSite=None and Secure.
 *
 * The default CookieCsrfTokenRepository uses browser defaults for SameSite,
 * which is Lax in modern browsers. This prevents the cookie from being sent
 * on cross-origin requests. For SPAs where frontend and backend are on
 * different domains, we need SameSite=None (with Secure).
 */
public class CrossOriginCsrfTokenRepository implements CsrfTokenRepository {

    private static final String DEFAULT_CSRF_COOKIE_NAME = "XSRF-TOKEN";
    private static final String DEFAULT_CSRF_HEADER_NAME = "X-XSRF-TOKEN";
    private static final String DEFAULT_CSRF_PARAMETER_NAME = "_csrf";
    private static final int COOKIE_MAX_AGE = (int) Duration.ofDays(365).getSeconds();

    @Override
    public CsrfToken generateToken(HttpServletRequest request) {
        return new DefaultCsrfToken(
                DEFAULT_CSRF_HEADER_NAME,
                DEFAULT_CSRF_PARAMETER_NAME,
                UUID.randomUUID().toString()
        );
    }

    @Override
    public void saveToken(CsrfToken token, HttpServletRequest request, HttpServletResponse response) {
        String tokenValue = (token != null) ? token.getToken() : "";

        if (!StringUtils.hasLength(tokenValue)) {
            // Token is null, delete the cookie
            ResponseCookie deleteCookie = ResponseCookie
                    .from(DEFAULT_CSRF_COOKIE_NAME, "")
                    .path("/")
                    .maxAge(0)
                    .secure(true)
                    .httpOnly(false)
                    .sameSite("None")
                    .build();
            response.addHeader("Set-Cookie", deleteCookie.toString());
        } else {
            // Create the CSRF token cookie with SameSite=None for cross-origin
            ResponseCookie csrfCookie = ResponseCookie
                    .from(DEFAULT_CSRF_COOKIE_NAME, tokenValue)
                    .path("/")
                    .maxAge(COOKIE_MAX_AGE)
                    .secure(true)
                    .httpOnly(false)
                    .sameSite("None")
                    .build();
            response.addHeader("Set-Cookie", csrfCookie.toString());
        }
    }

    @Override
    public CsrfToken loadToken(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, DEFAULT_CSRF_COOKIE_NAME);
        if (cookie == null) {
            return null;
        }
        return new DefaultCsrfToken(
                DEFAULT_CSRF_HEADER_NAME,
                DEFAULT_CSRF_PARAMETER_NAME,
                cookie.getValue()
        );
    }
}
