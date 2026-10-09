package com.ailearning.server;

import java.nio.charset.StandardCharsets;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Explicit local startup operation, no HTTP endpoint and no default credentials. */
@Component
@ConditionalOnProperty(name="app.bootstrap.enabled", havingValue="true")
public class AdminBootstrap implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final Environment environment;
    private final TransactionTemplate transaction;
    public AdminBootstrap(JdbcTemplate jdbc, PasswordEncoder encoder, Environment environment, TransactionTemplate transaction) {
        this.jdbc=jdbc; this.encoder=encoder; this.environment=environment; this.transaction=transaction;
    }
    @Override public void run(ApplicationArguments args) {
        String username = Accounts.normalize(environment.getProperty("BOOTSTRAP_ADMIN_USERNAME"));
        String password = environment.getProperty("BOOTSTRAP_ADMIN_PASSWORD", "");
        if (!username.matches("[a-z0-9_.-]{3,64}") || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new IllegalStateException("Bootstrap requires a valid username and a password of at least 12 characters, at most 72 UTF-8 bytes.");
        String hash = encoder.encode(password);
        transaction.executeWithoutResult(status -> {
            // Lock a permanent row so simultaneous bootstrap processes cannot create two first admins.
            Long role = jdbc.queryForObject("SELECT id FROM app_roles WHERE name='ADMIN' FOR UPDATE", Long.class);
            Long count = jdbc.queryForObject("SELECT COUNT(*) FROM app_user_roles WHERE role_id=?", Long.class, role);
            if (count != null && count > 0) throw new IllegalStateException("An administrator already exists; bootstrap refused.");
            if (!jdbc.queryForList("SELECT id FROM app_users WHERE username=?", Long.class, username).isEmpty())
                throw new IllegalStateException("Bootstrap username already exists; choose a new username.");
            jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,?,?,TRUE)", username, hash, username);
            Long id = jdbc.queryForObject("SELECT id FROM app_users WHERE username=?", Long.class, username);
            jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT ?,id FROM app_roles WHERE name IN ('ADMIN','USER')", id);
        });
    }
}
