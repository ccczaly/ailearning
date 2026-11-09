CREATE TABLE ai_plan_drafts (
    user_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    draft_json LONGTEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    PRIMARY KEY (user_id, conversation_id)
);
