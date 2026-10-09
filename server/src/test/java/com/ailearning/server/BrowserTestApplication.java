package com.ailearning.server;

import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Manual browser verification only. This class and H2 are excluded from the production jar. */
public class BrowserTestApplication {
    public static void main(String[] args) {
        var app = new SpringApplication(AiLearningServerApplication.class);
        // Command-line properties enforce isolation, regardless of local DB environment variables.
        var context = app.run("--spring.datasource.url=jdbc:h2:mem:browser;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "--spring.datasource.username=sa", "--spring.datasource.password=",
            "--spring.datasource.driver-class-name=org.h2.Driver", "--app.bootstrap.enabled=false",
            "--server.port=18080", "--server.address=127.0.0.1", "--server.servlet.session.timeout=30m");
        var jdbc = context.getBean(JdbcTemplate.class);
        String hash = context.getBean(PasswordEncoder.class).encode("browser-test-password");
        for (var entry : Map.of("browser-user", "USER", "browser-admin", "ADMIN", "browser-disabled", "USER").entrySet()) {
            jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,?,?,?)", entry.getKey(), hash, entry.getKey(), !entry.getKey().equals("browser-disabled"));
            jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name=?", entry.getKey(), entry.getValue());
        }
    }
}
