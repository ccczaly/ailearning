package com.ailearning.server;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Registration {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    public Registration(JdbcTemplate jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
    }
    @Transactional
    public void create(String username, String password) {
        Long role = jdbc.queryForObject("SELECT id FROM app_roles WHERE name='USER'", Long.class);
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,?,?,TRUE)",
            username, encoder.encode(password), username);
        Long user = jdbc.queryForObject("SELECT id FROM app_users WHERE username=?", Long.class, username);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) VALUES(?,?)", user, role);
    }
}
