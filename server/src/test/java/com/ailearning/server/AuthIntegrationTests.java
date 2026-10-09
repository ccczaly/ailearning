package com.ailearning.server;

import java.net.*;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.boot.web.servlet.ServletListenerRegistrationBean;
import jakarta.servlet.http.HttpSessionListener;
import jakarta.servlet.http.HttpSessionEvent;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(AuthIntegrationTests.ShortSessions.class)
class AuthIntegrationTests {
    @TestConfiguration static class ShortSessions {
        @Bean ServletListenerRegistrationBean<HttpSessionListener> shortSessions() {
            return new ServletListenerRegistrationBean<>(new HttpSessionListener() {
                @Override public void sessionCreated(HttpSessionEvent event) { event.getSession().setMaxInactiveInterval(2); }
            });
        }
    }
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    final String password = "test-only-password-42";
    HttpClient client;
    CookieManager cookies;
    @BeforeEach void setup() {
        cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        client = HttpClient.newBuilder().cookieHandler(cookies).build();
    }
    String user(boolean enabled, String role) {
        String name = "test-" + UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,?,?,?)", name, encoder.encode(password), "Test Person", enabled);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name=?", name, role);
        return name;
    }
    HttpResponse<String> send(String method, String path, String body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (token != null) builder.header("X-CSRF-TOKEN", token);
        if (method.equals("POST")) builder.header("Content-Type", "application/x-www-form-urlencoded");
        return client.send(builder.method(method, HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
    String token() throws Exception {
        var response = send("GET", "/api/auth/csrf", "", null);
        assertEquals(200, response.statusCode());
        var matcher = java.util.regex.Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"").matcher(response.body());
        assertTrue(matcher.find()); return matcher.group(1);
    }
    HttpResponse<String> login(String name, String pass, String token) throws Exception {
        return send("POST", "/api/auth/login", "username="+name+"&password="+pass, token);
    }
    String sessionId() { return cookies.getCookieStore().getCookies().stream().filter(c -> c.getName().equals("JSESSIONID")).findFirst().orElseThrow().getValue(); }
    @Test void anonymousAndCsrf() throws Exception {
        assertEquals(401, send("GET", "/api/me", "", null).statusCode());
        assertEquals(401, send("GET", "/api/admin/status", "", null).statusCode());
        assertEquals(403, login("someone", password, null).statusCode());
        assertEquals(403, login("someone", password, "invalid").statusCode());
        assertEquals(403, send("POST", "/api/auth/logout", "", null).statusCode());
    }
    @Test void loginRefreshLogoutAndFixation() throws Exception {
        String name = user(true, "USER");
        String csrf = token(); String previous = sessionId();
        assertEquals(204, login(name, password, csrf).statusCode());
        assertNotEquals(previous, sessionId());
        var me = send("GET", "/api/me", "", null);
        assertEquals(200, me.statusCode());
        assertTrue(me.body().contains("Test Person"));
        assertFalse(me.body().contains("password"));
        assertEquals(200, send("GET", "/api/me", "", null).statusCode());
        assertEquals(403, send("GET", "/api/admin/status", "", null).statusCode());
        assertEquals(403, send("POST", "/api/auth/logout", "", csrf).statusCode());
        String authenticatedSession = sessionId();
        assertEquals(204, send("POST", "/api/auth/logout", "", token()).statusCode());
        var replay = HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/me"))
            .header("Cookie", "JSESSIONID="+authenticatedSession).GET().build();
        assertEquals(401, HttpClient.newHttpClient().send(replay, HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(401, send("GET", "/api/me", "", null).statusCode());
    }
    @Test void wrongPasswordDisabledAndAdmin() throws Exception {
        String name = user(true, "ADMIN");
        String csrf = token();
        assertEquals(401, login(name, "wrong", csrf).statusCode());
        assertEquals(401, login(user(false, "USER"), password, csrf).statusCode());
        assertEquals(204, login(name, password, csrf).statusCode());
        assertEquals(200, send("GET", "/api/admin/status", "", null).statusCode());
        jdbc.update("UPDATE app_users SET enabled=FALSE WHERE username=?", name);
        assertEquals(401, send("GET", "/api/me", "", null).statusCode());
    }
    @Test void limitsFailures() throws Exception {
        String name = user(true, "USER"); String csrf = token();
        for (int i=0; i<5; i++) assertEquals(401, login(name, "wrong", csrf).statusCode());
        var limited = login(name, password, csrf);
        assertEquals(429, limited.statusCode());
        assertEquals("60", limited.headers().firstValue("Retry-After").orElseThrow());
    }
    @Test void changedRoleInvalidatesExistingSession() throws Exception {
        String name = user(true, "ADMIN");
        assertEquals(204, login(name, password, token()).statusCode());
        jdbc.update("DELETE FROM app_user_roles WHERE user_id=(SELECT id FROM app_users WHERE username=?)", name);
        assertEquals(401, send("GET", "/api/admin/status", "", null).statusCode());
    }
    @Test void cookieFlagsAndExpiry() throws Exception {
        var csrf = send("GET", "/api/auth/csrf", "", null);
        String cookie = csrf.headers().firstValue("Set-Cookie").orElseThrow();
        assertTrue(cookie.contains("HttpOnly")); assertTrue(cookie.contains("SameSite=Lax"));
        assertFalse(cookie.contains("Secure"));
        assertEquals(204, login(user(true, "USER"), password, token()).statusCode());
        Thread.sleep(2500);
        assertEquals(401, send("GET", "/api/me", "", null).statusCode());
    }

    @Test void registrationCreatesNormalUserAndCanLogin() throws Exception {
        String name = "signup-" + UUID.randomUUID();
        String body = "username=" + name.toUpperCase(Locale.ROOT) + "&password=" + password + "&roles=ADMIN&enabled=false";
        assertEquals(403, send("POST", "/api/auth/register", body, null).statusCode());
        assertEquals(403, send("POST", "/api/auth/register", body, "invalid").statusCode());
        assertEquals(204, send("POST", "/api/auth/register", body, token()).statusCode());
        String hash = jdbc.queryForObject("SELECT password_hash FROM app_users WHERE username=?", String.class, name);
        assertNotEquals(password, hash);
        assertTrue(encoder.matches(password, hash));
        assertEquals(List.of("USER"), jdbc.queryForList("SELECT r.name FROM app_roles r JOIN app_user_roles ur ON r.id=ur.role_id JOIN app_users u ON u.id=ur.user_id WHERE u.username=?", String.class, name));
        assertEquals(401, send("GET", "/api/me", "", null).statusCode());
        var duplicate = send("POST", "/api/auth/register", body, token());
        assertEquals(409, duplicate.statusCode());
        assertTrue(duplicate.body().contains("USERNAME_TAKEN"));
        assertEquals(204, login(name, password, token()).statusCode());
        assertEquals(200, send("GET", "/api/me", "", null).statusCode());
        assertEquals(403, send("GET", "/api/admin/status", "", null).statusCode());
    }
    @Test void registrationRejectsInvalidInput() throws Exception {
        String csrf = token();
        for (String body : List.of("", "username=a&password=" + password,
                "username=invalid%21&password=" + password,
                "username=valid-name&password=short",
                "username=valid-name&password=" + "x".repeat(73),
                "username=valid-name&password=" + URLEncoder.encode("密".repeat(25), java.nio.charset.StandardCharsets.UTF_8))) {
            assertEquals(400, send("POST", "/api/auth/register", body, csrf).statusCode());
        }
    }
    @Test void registrationIsRateLimited() throws Exception {
        String name = "limited-" + UUID.randomUUID();
        String body = "username=" + name + "&password=" + password;
        String csrf = token();
        assertEquals(204, send("POST", "/api/auth/register", body, csrf).statusCode());
        for (int i=0; i<4; i++) assertEquals(409, send("POST", "/api/auth/register", body, csrf).statusCode());
        var limited = send("POST", "/api/auth/register", body, csrf);
        assertEquals(429, limited.statusCode());
        assertEquals("60", limited.headers().firstValue("Retry-After").orElseThrow());
    }
}
