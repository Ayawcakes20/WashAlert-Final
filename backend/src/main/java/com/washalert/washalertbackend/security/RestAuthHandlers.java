package com.washalert.washalertbackend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.washalert.washalertbackend.common.ApiError;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

@Component
public class RestAuthHandlers implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper mapper;

    public RestAuthHandlers(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    // 401 - not logged in / auth failed
    @Override
    public void commence(
            HttpServletRequest request,
            @NonNull HttpServletResponse response,
            AuthenticationException ex
    ) throws IOException {

        String msg;
        if (ex instanceof BadCredentialsException) {
            msg = "Email or password is incorrect.";
        } else if (ex instanceof DisabledException) {
            msg = "Please verify your email before logging in.";
        } else if (ex instanceof LockedException) {
            msg = "Your account is locked. Please contact support.";
        } else {
            msg = "Unauthorized.";
        }

        write(request, response, HttpServletResponse.SC_UNAUTHORIZED, msg);
    }

    // 403 - logged in but forbidden
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex)
            throws IOException {
        write(request, response, HttpServletResponse.SC_FORBIDDEN, "Forbidden");
    }

    private void write(HttpServletRequest request, HttpServletResponse response, int status, String message)
            throws IOException {

        // If response already started, do not attempt a second write
        if (response.isCommitted()) return;

        // Clear any partially written body (doesn't clear headers/status)
        response.resetBuffer();

        ApiError err = new ApiError(
                Instant.now(),
                status,
                message,
                request.getRequestURI()
        );

        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        // ✅ Use output stream ONLY (prevents Writer/OutputStream conflict)
        ServletOutputStream out = response.getOutputStream();
        mapper.writeValue(out, err);
        out.flush();
    }
}
