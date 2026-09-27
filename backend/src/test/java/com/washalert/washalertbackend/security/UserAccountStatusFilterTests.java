package com.washalert.washalertbackend.security;

import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import com.washalert.washalertbackend.user.UserStatus;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserAccountStatusFilterTests {

    private UserRepository userRepository;
    private RestAuthHandlers restAuthHandlers;
    private UserAccountStatusFilter filter;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        restAuthHandlers = mock(RestAuthHandlers.class);
        filter = new UserAccountStatusFilter(userRepository, restAuthHandlers);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void whenUserIsDeactivated_thenSessionIsInvalidated_contextCleared_and401Returned() throws Exception {
        User userInDb = User.builder()
                .id(100L)
                .email("staff@washalert.ph")
                .fullName("Staff User")
                .role(Role.STAFF)
                .provider(AuthProvider.LOCAL)
                .status(UserStatus.DEACTIVATED)
                .enabled(false)
                .deactivatedAt(LocalDateTime.now())
                .build();

        when(userRepository.findById(100L)).thenReturn(Optional.of(userInDb));

        User userInSession = User.builder()
                .id(100L)
                .email("staff@washalert.ph")
                .fullName("Staff User")
                .role(Role.STAFF)
                .provider(AuthProvider.LOCAL)
                .status(UserStatus.ACTIVE)
                .enabled(true)
                .build();

        AuthUserDetails principal = new AuthUserDetails(userInSession);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        HttpSession session = mock(HttpSession.class);
        FilterChain filterChain = mock(FilterChain.class);

        when(request.getSession(false)).thenReturn(session);
        when(request.getRequestURI()).thenReturn("/api/orders");

        filter.doFilter(request, response, filterChain);

        // Verify session invalidated
        verify(session).invalidate();

        // Verify SecurityContext cleared
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();

        // Verify commence called with DisabledException
        verify(restAuthHandlers).commence(eq(request), eq(response), any(DisabledException.class));

        // Verify filterChain was NOT called (request aborted)
        verify(filterChain, never()).doFilter(any(), any());
    }

    @Test
    void whenUserIsActive_thenFilterChainProceeds_andSessionPreserved() throws Exception {
        User activeUser = User.builder()
                .id(101L)
                .email("active_staff@washalert.ph")
                .fullName("Active Staff")
                .role(Role.STAFF)
                .provider(AuthProvider.LOCAL)
                .status(UserStatus.ACTIVE)
                .enabled(true)
                .build();

        when(userRepository.findById(101L)).thenReturn(Optional.of(activeUser));

        AuthUserDetails principal = new AuthUserDetails(activeUser);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        HttpSession session = mock(HttpSession.class);
        FilterChain filterChain = mock(FilterChain.class);

        when(request.getSession(false)).thenReturn(session);
        when(request.getRequestURI()).thenReturn("/api/orders");

        filter.doFilter(request, response, filterChain);

        // Verify session was NOT invalidated
        verify(session, never()).invalidate();

        // Verify authentication remains intact
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();

        // Verify commence was NOT called
        verify(restAuthHandlers, never()).commence(any(), any(), any());

        // Verify filterChain proceeded
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void whenRequestIsAnonymous_thenFilterChainProceeds() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain filterChain = mock(FilterChain.class);

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verify(restAuthHandlers, never()).commence(any(), any(), any());
    }

    @Test
    void whenUserIsSuspended_thenSessionIsInvalidated_and401Returned() throws Exception {
        User suspendedUser = User.builder()
                .id(102L)
                .email("suspended@washalert.ph")
                .fullName("Suspended Staff")
                .role(Role.STAFF)
                .provider(AuthProvider.LOCAL)
                .status(UserStatus.SUSPENDED)
                .enabled(false)
                .build();

        when(userRepository.findById(102L)).thenReturn(Optional.of(suspendedUser));

        User userInSession = User.builder()
                .id(102L)
                .email("suspended@washalert.ph")
                .fullName("Suspended Staff")
                .role(Role.STAFF)
                .provider(AuthProvider.LOCAL)
                .status(UserStatus.ACTIVE)
                .enabled(true)
                .build();

        AuthUserDetails principal = new AuthUserDetails(userInSession);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        HttpSession session = mock(HttpSession.class);
        FilterChain filterChain = mock(FilterChain.class);

        when(request.getSession(false)).thenReturn(session);
        when(request.getRequestURI()).thenReturn("/api/orders");

        filter.doFilter(request, response, filterChain);

        verify(session).invalidate();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(restAuthHandlers).commence(eq(request), eq(response), any(DisabledException.class));
        verify(filterChain, never()).doFilter(any(), any());
    }
}
