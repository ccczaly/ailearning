package com.ailearning.server;

import java.util.List;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final Accounts accounts;
    private final AiService ai;

    public AiController(Accounts accounts, AiService ai) {
        this.accounts = accounts;
        this.ai = ai;
    }

    public record ChatRequest(String message, Long sectionId, Long conversationId) {}

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> chat(@RequestBody ChatRequest request, Authentication authentication) {
        var emitter = ai.chat(accounts.profile(authentication.getName()).id(), request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .header("X-Accel-Buffering", "no").body(emitter);
    }

    @GetMapping("/conversations")
    public List<AiRepository.Conversation> conversations(@RequestParam(required = false) Long sectionId,
            Authentication authentication) {
        return ai.conversations(accounts.profile(authentication.getName()).id(), sectionId);
    }

    @GetMapping("/conversations/{id}/messages")
    public List<AiRepository.Message> messages(@PathVariable long id, Authentication authentication) {
        return ai.messages(accounts.profile(authentication.getName()).id(), id);
    }

    @ExceptionHandler(AiException.class)
    public ResponseEntity<Map<String, String>> error(AiException exception) {
        return ResponseEntity.status(exception.status()).contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("code", exception.code()));
    }
}
