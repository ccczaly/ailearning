package com.ailearning.server;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class AiRepository {
    private static final tools.jackson.databind.ObjectMapper JSON=new tools.jackson.databind.ObjectMapper();
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;

    public AiRepository(JdbcTemplate jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    public record Conversation(long id, String title, Long sectionId, Instant updatedAt) {}
    public record Message(long id, String role, String content, String status, Instant createdAt, List<AiAction> actions) {
        public Message(long id, String role, String content, String status, Instant createdAt) {
            this(id, role, content, status, createdAt, List.of());
        }
    }

    private static List<AiAction> readActions(String json) {
        if(json==null || json.isBlank()) return List.of();
        return List.copyOf(java.util.Arrays.asList(JSON.readValue(json,AiAction[].class)));
    }
    public record Turn(long conversationId, long userMessageId, long assistantMessageId) {}

    @EventListener(ApplicationReadyEvent.class)
    public void interruptUnfinishedStreams() {
        // This local deployment runs one backend instance. After a restart there
        // is no provider subscription left to finish an earlier streaming row.
        jdbc.update("UPDATE ai_messages SET status='CANCELLED',updated_at=? WHERE status='STREAMING'",
            Timestamp.from(Instant.now()));
    }

    public Conversation owned(long userId, long conversationId) {
        return jdbc.query("SELECT id,title,section_id,updated_at FROM ai_conversations WHERE id=? AND user_id=?",
            (rs, n) -> new Conversation(rs.getLong("id"), rs.getString("title"),
                rs.getObject("section_id", Long.class), rs.getTimestamp("updated_at").toInstant()),
            conversationId, userId).stream().findFirst()
            .orElseThrow(() -> new AiException(HttpStatus.NOT_FOUND, "AI_CONVERSATION_NOT_FOUND"));
    }

    public List<Conversation> conversations(long userId, Long sectionId) {
        String scope = sectionId == null ? "section_id IS NULL" : "section_id=?";
        Object[] args = sectionId == null ? new Object[] {userId} : new Object[] {userId, sectionId};
        return jdbc.query("SELECT id,title,section_id,updated_at FROM ai_conversations WHERE user_id=? AND "
            + scope + " ORDER BY updated_at DESC,id DESC LIMIT 50",
            (rs, n) -> new Conversation(rs.getLong("id"), rs.getString("title"),
                rs.getObject("section_id", Long.class), rs.getTimestamp("updated_at").toInstant()), args);
    }

    public List<Message> messages(long conversationId) {
        // A live assistant is delivered through SSE. The history API exposes only
        // terminal statuses; the next refresh includes the completed partial text.
        return jdbc.query("""
            SELECT id,role,content,status,created_at,actions_json FROM ai_messages
            WHERE conversation_id=? AND status<>'STREAMING' ORDER BY id DESC LIMIT 100
            """, (rs, n) -> new Message(rs.getLong("id"), rs.getString("role"), rs.getString("content"),
                rs.getString("status"), rs.getTimestamp("created_at").toInstant(), readActions(rs.getString("actions_json"))), conversationId)
            .reversed();
    }

    public List<Message> history(long conversationId, int limit) {
        if (limit == 0) return List.of();
        // Include both sides of successful turns only. A cancelled/failed question
        // must not become an unanswered instruction in the next model request.
        var rows = jdbc.query("""
            SELECT m.id,m.role,m.content,m.status,m.created_at FROM ai_messages m
            WHERE m.conversation_id=? AND m.status='COMPLETED' AND
                (m.role='assistant' OR EXISTS (
                    SELECT 1 FROM ai_messages a WHERE a.reply_to_id=m.id
                        AND a.role='assistant' AND a.status='COMPLETED'))
            ORDER BY m.id DESC LIMIT ?
            """, (rs, n) -> new Message(rs.getLong("id"), rs.getString("role"), rs.getString("content"),
                rs.getString("status"), rs.getTimestamp("created_at").toInstant()), conversationId, limit);
        Collections.reverse(rows);
        return rows;
    }

    public Turn start(long userId, Long sectionId, Long conversationId, String message) {
        return Objects.requireNonNull(transactions.execute(status -> {
            Instant now = Instant.now();
            long id;
            if (conversationId == null) {
                id = insert("INSERT INTO ai_conversations(user_id,section_id,title,created_at,updated_at) VALUES(?,?,?,?,?)",
                    userId, sectionId, AiService.truncate(message, 60), Timestamp.from(now), Timestamp.from(now));
            } else {
                var conversation = owned(userId, conversationId);
                if (!Objects.equals(conversation.sectionId(), sectionId))
                    throw new AiException(HttpStatus.BAD_REQUEST, "AI_CONVERSATION_SCOPE_MISMATCH");
                id = conversation.id();
                jdbc.update("UPDATE ai_conversations SET updated_at=? WHERE id=?", Timestamp.from(now), id);
            }
            long userMessageId = insert("""
                INSERT INTO ai_messages(conversation_id,role,content,status,created_at,updated_at)
                VALUES(?,'user',?,'COMPLETED',?,?)
                """, id, message, Timestamp.from(now), Timestamp.from(now));
            long assistantMessageId = insert("""
                INSERT INTO ai_messages(conversation_id,reply_to_id,role,content,status,created_at,updated_at)
                VALUES(?,?,'assistant','','STREAMING',?,?)
                """, id, userMessageId, Timestamp.from(now), Timestamp.from(now));
            return new Turn(id, userMessageId, assistantMessageId);
        }));
    }

    public void finish(Turn turn, String content, String result) {
        finish(turn, content, result, List.of());
    }

    public void finish(Turn turn, String content, String result, List<AiAction> actions) {
        String actionsJson=JSON.writeValueAsString(result.equals("COMPLETED") ? actions : List.of());
        transactions.executeWithoutResult(status -> {
            var now = Timestamp.from(Instant.now());
            jdbc.update("UPDATE ai_messages SET content=?,status=?,actions_json=?,updated_at=? WHERE id=? AND status='STREAMING'",
                content, result, actionsJson, now, turn.assistantMessageId());
            jdbc.update("UPDATE ai_conversations SET updated_at=? WHERE id=?", now, turn.conversationId());
        });
    }

    private long insert(String sql, Object... args) {
        var holder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) statement.setObject(i + 1, args[i]);
            return statement;
        }, holder);
        return Objects.requireNonNull(holder.getKey()).longValue();
    }
}
