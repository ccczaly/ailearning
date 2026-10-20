CREATE TABLE historical_explorations (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT NOT NULL,
 chapter_key VARCHAR(40) NOT NULL,
 version INT NOT NULL,
 scheme VARCHAR(30) NOT NULL,
 initial_reason TEXT NOT NULL,
 revealed BOOLEAN NOT NULL DEFAULT FALSE,
 started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (user_id) REFERENCES app_users(id)
);
CREATE INDEX idx_exploration_user ON historical_explorations(user_id,chapter_key,id);
CREATE TABLE historical_reflections (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 exploration_id BIGINT NOT NULL,
 judgment VARCHAR(20) NOT NULL,
 explanation TEXT NOT NULL,
 strength TEXT NOT NULL,
 improvement TEXT NOT NULL,
 passed BOOLEAN NOT NULL,
 review_status VARCHAR(20) NOT NULL,
 rubric_version INT NOT NULL,
 model_name VARCHAR(120) NOT NULL,
 rubric_snapshot TEXT NOT NULL,
 submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (exploration_id) REFERENCES historical_explorations(id)
);
