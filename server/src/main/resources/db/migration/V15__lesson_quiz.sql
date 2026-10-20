CREATE TABLE quiz_attempts (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT NOT NULL,
 section_id BIGINT NOT NULL,
 quiz_version INT NOT NULL,
 score INT NOT NULL,
 total INT NOT NULL,
 passed BOOLEAN NOT NULL,
 submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (user_id) REFERENCES app_users(id),
 FOREIGN KEY (section_id) REFERENCES knowledge_sections(id)
);
CREATE INDEX idx_quiz_history ON quiz_attempts(user_id,section_id,id);
CREATE TABLE quiz_answers (
 attempt_id BIGINT NOT NULL,
 question_id VARCHAR(80) NOT NULL,
 knowledge_tag VARCHAR(120) NOT NULL,
 question_snapshot TEXT NOT NULL,
 options_snapshot TEXT NOT NULL,
 selected_option INT NOT NULL,
 correct_option INT NOT NULL,
 correct BOOLEAN NOT NULL,
 explanation_snapshot TEXT NOT NULL,
 PRIMARY KEY (attempt_id,question_id),
 FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id)
);
-- Manual completion is a reading record, not evidence of passing a quiz.
UPDATE user_section_progress SET status='IN_PROGRESS',completed_at=NULL WHERE section_id IN (
 SELECT s.id FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id
 WHERE p.slug='llm-basics' AND s.title IN ('1950：机器能思考吗？','模仿游戏：用文字观察机器')
);
