package com.washalert.washalertbackend.security;

import com.washalert.washalertbackend.user.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.*;

public class AuthUserDetails implements UserDetails, OAuth2User {

    private final User user;
    private final Map<String, Object> attributes;

    public AuthUserDetails(User user) {
        this(user, Collections.emptyMap());
    }

    public AuthUserDetails(User user, Map<String, Object> attributes) {
        this.user = user;
        this.attributes = (attributes == null) ? Collections.emptyMap() : new HashMap<>(attributes);
    }

    public User getUser() {
        return user;
    }

    // ---- UserDetails ----

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Your codebase uses hasRole("ADMIN") / hasRole("STAFF")
        // so we must return ROLE_ADMIN / ROLE_STAFF
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return true; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() {
        return user.isEnabled();
    }

    // ---- OAuth2User ----

    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    @Override
    public String getName() {
        // For OAuth2User, "name" must be stable; email is best
        return user.getEmail();
    }
}
