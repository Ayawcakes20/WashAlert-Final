package com.washalert.washalertbackend.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class AuthRouteMappingTests {

    @Test
    void authControllerHasApiAuthBasePath() {
        RequestMapping requestMapping = AuthController.class.getAnnotation(RequestMapping.class);
        assertThat(requestMapping).isNotNull();
        assertThat(requestMapping.value()).contains("/api/auth");
    }

    @Test
    void registerEndpointIsMapped() throws NoSuchMethodException {
        Method registerMethod = AuthController.class.getDeclaredMethod("register", HttpServletRequest.class);
        PostMapping postMapping = registerMethod.getAnnotation(PostMapping.class);

        assertThat(postMapping).isNotNull();
        assertThat(postMapping.value()).contains("/register");
    }

    @Test
    void loginEndpointIsMapped() throws NoSuchMethodException {
        Method loginMethod = AuthController.class.getDeclaredMethod(
                "login",
                HttpServletRequest.class
        );
        PostMapping postMapping = loginMethod.getAnnotation(PostMapping.class);

        assertThat(postMapping).isNotNull();
        assertThat(postMapping.value()).contains("/login");
    }

    @Test
    void setPasswordEndpointIsMapped() throws NoSuchMethodException {
        Method setPasswordMethod = AuthController.class.getDeclaredMethod(
                "setPassword",
                com.washalert.washalertbackend.auth.dto.SetPasswordRequest.class,
                HttpServletRequest.class
        );
        PostMapping postMapping = setPasswordMethod.getAnnotation(PostMapping.class);

        assertThat(postMapping).isNotNull();
        assertThat(postMapping.value()).contains("/set-password");
    }

    @Test
    void firebaseSessionEndpointIsMapped() throws NoSuchMethodException {
        Method firebaseSessionMethod = AuthController.class.getDeclaredMethod(
                "firebaseSession",
                com.washalert.washalertbackend.auth.dto.FirebaseSessionRequest.class,
                Authentication.class,
                HttpServletRequest.class
        );
        PostMapping postMapping = firebaseSessionMethod.getAnnotation(PostMapping.class);

        assertThat(postMapping).isNotNull();
        assertThat(postMapping.value()).contains("/firebase-session");
    }
}
