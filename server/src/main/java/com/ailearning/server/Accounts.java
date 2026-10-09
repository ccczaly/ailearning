package com.ailearning.server;

import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.security.core.userdetails.*;

@Service
public class Accounts implements UserDetailsService {
    private final JdbcTemplate jdbc;
    public Accounts(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public static String normalize(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }
    public record Profile(long id, String username, String displayName, boolean enabled, List<String> roles) {}
    public Profile profile(String username) {
        return jdbc.query("SELECT id, username, display_name, enabled FROM app_users WHERE username = ?",
            (rs, row) -> new Profile(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getBoolean(4), roles(rs.getLong(1))),
            normalize(username)).stream().findFirst().orElseThrow(() -> new UsernameNotFoundException("Unknown user"));
    }
    private List<String> roles(long id) {
        return jdbc.queryForList("SELECT r.name FROM app_roles r JOIN app_user_roles ur ON ur.role_id=r.id WHERE ur.user_id=? ORDER BY r.name", String.class, id);
    }
    @Override public UserDetails loadUserByUsername(String username) {
        var profile = profile(username);
        var hash = jdbc.queryForObject("SELECT password_hash FROM app_users WHERE id=?", String.class, profile.id());
        return User.withUsername(profile.username()).password(hash).disabled(!profile.enabled())
            .roles(profile.roles().toArray(String[]::new)).build();
    }
}
