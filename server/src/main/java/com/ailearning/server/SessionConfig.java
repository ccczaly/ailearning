package com.ailearning.server;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration(proxyBeanMethods=false)
public class SessionConfig {
    @Bean CookieSerializer sessionCookieSerializer(
            @Value("${server.servlet.session.cookie.secure:false}") boolean secure) {
        var cookie=new DefaultCookieSerializer();
        // Match the existing login/logout contract instead of Spring Session's default SESSION cookie.
        cookie.setCookieName("JSESSIONID");
        cookie.setCookiePath("/");
        cookie.setUseHttpOnlyCookie(true);
        cookie.setSameSite("Lax");
        cookie.setUseSecureCookie(secure);
        cookie.setUseBase64Encoding(false);
        return cookie;
    }
}
