package com.ailearning.server;

import java.io.IOException;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    static void error(HttpServletResponse response, int status, String code) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":\"" + code + "\"}");
    }
    @Bean SecurityFilterChain security(HttpSecurity http, LoginLimiter limiter, Accounts accounts) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/csrf", "/api/auth/login", "/api/auth/register", "/api/actuator/health").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .requestCache(cache -> cache.disable())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, ex) -> error(response, 401, "UNAUTHENTICATED"))
                .accessDeniedHandler((request, response, ex) -> error(response, 403,
                    ex instanceof CsrfException ? "CSRF_INVALID" : "FORBIDDEN")))
            .sessionManagement(session -> session.sessionFixation(fixation -> fixation.changeSessionId()))
            .formLogin(login -> login.loginProcessingUrl("/api/auth/login")
                .successHandler((request, response, auth) -> {
                    limiter.success(auth.getName());
                    response.setStatus(204);
                })
                .failureHandler((request, response, ex) -> error(response, 401, "INVALID_CREDENTIALS")))
            .logout(logout -> logout.logoutUrl("/api/auth/logout")
                .invalidateHttpSession(true).clearAuthentication(true).deleteCookies("JSESSIONID")
                .logoutSuccessHandler((request, response, auth) -> response.setStatus(204)));

        http.addFilterBefore(new OncePerRequestFilter() {
            @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                    throws ServletException, IOException {
                if (request.getServletPath().equals("/api/auth/login") && request.getMethod().equals("POST")) {
                    String username = request.getParameter("username");
                    String password = request.getParameter("password");
                    if (username == null || !Accounts.normalize(username).matches("[a-z0-9_.-]{3,64}")
                            || password == null || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
                        error(response, 401, "INVALID_CREDENTIALS"); return;
                    }
                    // Do not trust client-supplied X-Forwarded-For headers.
                    if (!limiter.acquire(request.getRemoteAddr(), username)) {
                        response.setHeader("Retry-After", "60");
                        error(response, 429, "LOGIN_RATE_LIMITED"); return;
                    }
                }
                chain.doFilter(request, response);
            }
        }, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(new OncePerRequestFilter() {
            @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                    throws ServletException, IOException {
                var auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
                    boolean valid;
                    try {
                        var current = accounts.loadUserByUsername(auth.getName());
                        var sessionRoles = auth.getAuthorities().stream()
                            .filter(authority -> authority.getAuthority().startsWith("ROLE_"))
                            .collect(java.util.stream.Collectors.toSet());
                        valid = current.isEnabled() && new java.util.HashSet<>(current.getAuthorities()).equals(sessionRoles);
                    } catch (UsernameNotFoundException ex) { valid = false; }
                    if (!valid) {
                        var session = request.getSession(false);
                        if (session != null) session.invalidate();
                        SecurityContextHolder.clearContext();
                        error(response, 401, "UNAUTHENTICATED"); return;
                    }
                }
                chain.doFilter(request, response);
            }
        }, AuthorizationFilter.class);
        return http.build();
    }
}
