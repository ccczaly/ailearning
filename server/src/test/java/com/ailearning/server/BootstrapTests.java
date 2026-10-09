package com.ailearning.server;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class BootstrapTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired TransactionTemplate transaction;
    @Test void createsAdminAndRefusesSecondInitialization() {
        // Only the isolated H2 test database is changed, and this test rolls back.
        jdbc.update("DELETE FROM app_user_roles WHERE role_id=(SELECT id FROM app_roles WHERE name='ADMIN')");
        String name = "admin-" + UUID.randomUUID();
        var env = new MockEnvironment().withProperty("BOOTSTRAP_ADMIN_USERNAME", name)
            .withProperty("BOOTSTRAP_ADMIN_PASSWORD", "test-only-admin-password");
        var bootstrap = new AdminBootstrap(jdbc, encoder, env, transaction);
        bootstrap.run(new DefaultApplicationArguments());
        var hash = jdbc.queryForObject("SELECT password_hash FROM app_users WHERE username=?", String.class, name);
        assertTrue(encoder.matches("test-only-admin-password", hash));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM app_user_roles ur JOIN app_users u ON u.id=ur.user_id WHERE u.username=?", Integer.class, name));
        assertThrows(IllegalStateException.class, () -> bootstrap.run(new DefaultApplicationArguments()));
    }
    @Test void rejectsMissingCredentials() {
        var bootstrap = new AdminBootstrap(jdbc, encoder, new MockEnvironment(), transaction);
        assertThrows(IllegalStateException.class, () -> bootstrap.run(new DefaultApplicationArguments()));
    }
}
