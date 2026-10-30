package com.ailearning.server;

import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SessionRestartTests {
    private Process backend;
    private int port;
    private final CookieManager cookies=new CookieManager(null,CookiePolicy.ACCEPT_ALL);
    private final HttpClient client=HttpClient.newBuilder().cookieHandler(cookies).connectTimeout(Duration.ofSeconds(3)).build();

    void start(Path directory,int number) throws Exception {
        String javaExecutable=Path.of(System.getProperty("java.home"),"bin","java.exe").toString();
        if(!Files.exists(Path.of(javaExecutable))) javaExecutable=Path.of(System.getProperty("java.home"),"bin","java").toString();
        Path log=directory.resolve("backend-"+number+".log");
        backend=new ProcessBuilder(javaExecutable,"-cp",System.getProperty("java.class.path"),SessionRestartTestApplication.class.getName(),
            "--spring.datasource.url="+databaseUrl(directory),
            "--spring.datasource.username=sa","--spring.datasource.password=","--spring.datasource.driver-class-name=org.h2.Driver",
            "--server.port=0","--server.address=127.0.0.1","--server.servlet.session.timeout=2m",
            "--spring.session.jdbc.initialize-schema=never","--spring.ai.model.chat=none","--app.bootstrap.enabled=false")
            .redirectErrorStream(true).redirectOutput(log.toFile()).start();
        long deadline=System.nanoTime()+Duration.ofSeconds(45).toNanos();
        while(System.nanoTime()<deadline) {
            String output=Files.exists(log)?Files.readString(log):"";
            var ready=java.util.regex.Pattern.compile("SESSION_RESTART_READY=(\\d+)").matcher(output);
            if(ready.find()){port=Integer.parseInt(ready.group(1));return;}
            if(!backend.isAlive()) fail("Restart fixture exited: "+output);
            Thread.sleep(100);
        }
        fail("Restart fixture did not become ready: "+Files.readString(log));
    }
    void stop() throws Exception {
        if(backend==null)return;
        backend.destroy();
        if(!backend.waitFor(10,TimeUnit.SECONDS)){backend.destroyForcibly();assertTrue(backend.waitFor(5,TimeUnit.SECONDS));}
        backend=null;
    }
    HttpResponse<String> send(String method,String path,String body,String token) throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(10));
        if(token!=null)request.header("X-CSRF-TOKEN",token);
        if(method.equals("POST"))request.header("Content-Type","application/x-www-form-urlencoded");
        return client.send(request.method(method,HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
    }
    String token() throws Exception {
        var response=send("GET","/api/auth/csrf","",null);assertEquals(200,response.statusCode());
        return new tools.jackson.databind.ObjectMapper().readTree(response.body()).get("token").asString();
    }
    String cookie(){return cookies.getCookieStore().getCookies().stream().filter(c->c.getName().equals("JSESSIONID")).findFirst().orElseThrow().getValue();}
    // Windows process termination is abrupt; force H2 to flush commits before acknowledging requests.
    String databaseUrl(Path directory){return "jdbc:h2:file:"+directory.resolve("sessions").toAbsolutePath().toString().replace('\\','/')+";MODE=MySQL;DB_CLOSE_ON_EXIT=FALSE;WRITE_DELAY=0";}

    @Test void authenticatedCookieAndCsrfSurviveARealJvmRestartButLogoutRemainsEffective() throws Exception {
        Path directory=Files.createTempDirectory(Path.of("target").toAbsolutePath(),"session-restart-");
        try {
            start(directory,1);
            String anonymous=cookieAfterCsrf();
            assertEquals(204,send("POST","/api/auth/login","username=restart-reader&password=restart-test-password",token()).statusCode());
            String authenticated=cookie();assertNotEquals(anonymous,authenticated);
            String csrf=token();
            assertEquals(200,send("GET","/api/me","",null).statusCode());
            long firstPid=backend.pid();stop();
            try(var connection=java.sql.DriverManager.getConnection(databaseUrl(directory),"sa","");
                    var statement=connection.prepareStatement("SELECT PRINCIPAL_NAME,MAX_INACTIVE_INTERVAL FROM SPRING_SESSION WHERE SESSION_ID=?")) {
                statement.setString(1,authenticated);
                try(var rows=statement.executeQuery()){assertTrue(rows.next(),"Authenticated session must be on disk before restart");assertEquals("restart-reader",rows.getString(1));assertEquals(120,rows.getInt(2));}
            }
            start(directory,2);assertNotEquals(firstPid,backend.pid());
            var restored=send("GET","/api/me","",null);
            assertEquals(200,restored.statusCode(),restored.body());assertTrue(restored.body().contains("restart-reader"));assertEquals(authenticated,cookie());
            assertEquals(204,send("POST","/api/auth/logout","",csrf).statusCode());
            assertEquals(401,send("GET","/api/me","",null).statusCode());
            stop();start(directory,3);
            var replay=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/me")).header("Cookie","JSESSIONID="+authenticated).GET().build();
            assertEquals(401,HttpClient.newHttpClient().send(replay,HttpResponse.BodyHandlers.ofString()).statusCode());
        } finally {stop();}
    }
    String cookieAfterCsrf() throws Exception {token();return cookie();}
}
