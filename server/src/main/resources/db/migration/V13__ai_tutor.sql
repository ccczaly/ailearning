CREATE TABLE ai_conversations (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT NOT NULL,
 section_id BIGINT,
 title VARCHAR(120) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY (user_id) REFERENCES app_users(id),
 FOREIGN KEY (section_id) REFERENCES knowledge_sections(id)
);
CREATE INDEX idx_ai_conversation_scope ON ai_conversations(user_id,section_id,updated_at);

CREATE TABLE ai_messages (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 conversation_id BIGINT NOT NULL,
 reply_to_id BIGINT,
 role VARCHAR(10) NOT NULL,
 content MEDIUMTEXT NOT NULL,
 status VARCHAR(20) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id),
 FOREIGN KEY (reply_to_id) REFERENCES ai_messages(id),
 CHECK (role IN ('user','assistant')),
 CHECK (status IN ('STREAMING','COMPLETED','CANCELLED','FAILED'))
);
CREATE INDEX idx_ai_message_history ON ai_messages(conversation_id,id);

-- UTC dates and counts are written by the application. Both successful and failed
-- provider attempts consume quota, since a failed stream can still be billable.
CREATE TABLE ai_daily_usage (
 usage_date DATE NOT NULL,
 scope_key VARCHAR(40) NOT NULL,
 request_count INT NOT NULL DEFAULT 0,
 PRIMARY KEY (usage_date,scope_key),
 CHECK (request_count >= 0)
);
