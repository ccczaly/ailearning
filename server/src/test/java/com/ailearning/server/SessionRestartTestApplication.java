package com.ailearning.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;

/** Child-JVM fixture; accepts an isolated file-backed H2 database only. Not packaged in production. */
public class SessionRestartTestApplication {
    public static void main(String[] args) {
        if(java.util.Arrays.stream(args).noneMatch(arg -> arg.startsWith("--spring.datasource.url=jdbc:h2:file:")))
            throw new IllegalArgumentException("Restart fixture requires a file-backed H2 test database");
        var context=SpringApplication.run(AiLearningServerApplication.class,args);
        context.getBean(JdbcIndexedSessionRepository.class);
        var jdbc=context.getBean(JdbcTemplate.class);
        if(jdbc.queryForObject("SELECT COUNT(*) FROM app_users WHERE username='restart-reader'",Integer.class)==0) {
            jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES('restart-reader',?,'Restart Reader',TRUE)",
                context.getBean(PasswordEncoder.class).encode("restart-test-password"));
            jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username='restart-reader' AND r.name='USER'");
        }
        System.out.println("SESSION_RESTART_READY="+((WebServerApplicationContext)context).getWebServer().getPort());
    }
}
