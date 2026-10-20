package com.ailearning.server;

/** UI operations are created by application code, never parsed from model text. */
public record AiAction(String type, String label, String url) {}
