package com.ailearning.server;

import org.springframework.http.HttpStatus;

/** Only a safe, stable code is exposed to the client. */
public class AiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public AiException(HttpStatus status, String code) {
        super(code);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
}
