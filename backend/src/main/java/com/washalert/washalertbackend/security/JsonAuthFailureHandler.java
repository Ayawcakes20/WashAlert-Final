package com.washalert.washalertbackend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.washalert.washalertbackend.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

@Component
public class JsonAuthFailureHandler implements AuthenticationFailureHandler {

    private final ObjectMapper mapper;

    public JsonAuthFailureHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException ex
    ) throws IOException {

        String message = "Authentication failed";

        if (ex instanceof BadCredentialsException) {
            message = "Email or password is incorrect.";
        } else if (ex instanceof DisabledException) {
            message = "Please verify your email before logging in.";
        }

        ApiError err = new ApiError(
                Instant.now(),
                401,
                message,
                request.getRequestURI()
        );

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getWriter(), err);
    }
}
