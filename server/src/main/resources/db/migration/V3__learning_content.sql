CREATE TABLE learning_modules (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 code VARCHAR(64) NOT NULL UNIQUE,
 title VARCHAR(100) NOT NULL,
 description VARCHAR(500),
 sort_order INT NOT NULL DEFAULT 0,
 status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED'))
);
CREATE TABLE knowledge_points (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 module_id BIGINT NOT NULL,
 slug VARCHAR(100) NOT NULL UNIQUE,
 title VARCHAR(150) NOT NULL,
 summary VARCHAR(500),
 learning_objectives TEXT,
 difficulty VARCHAR(20) NOT NULL DEFAULT 'BEGINNER',
 estimated_minutes INT,
 sort_order INT NOT NULL DEFAULT 0,
 status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (module_id) REFERENCES learning_modules(id),
 CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 CHECK (difficulty IN ('BEGINNER','INTERMEDIATE','ADVANCED')),
 CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0)
);
CREATE INDEX idx_points_module ON knowledge_points(module_id,status,sort_order);
CREATE TABLE knowledge_sections (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 knowledge_point_id BIGINT NOT NULL,
 parent_id BIGINT,
 node_type VARCHAR(20) NOT NULL,
 title VARCHAR(150) NOT NULL,
 content_markdown MEDIUMTEXT,
 estimated_minutes INT,
 sort_order INT NOT NULL DEFAULT 0,
 status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE (knowledge_point_id,id),
 FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id),
 FOREIGN KEY (knowledge_point_id,parent_id) REFERENCES knowledge_sections(knowledge_point_id,id),
 CHECK (node_type IN ('DIRECTORY','LESSON')),
 CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 CHECK (node_type <> 'DIRECTORY' OR content_markdown IS NULL),
 CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0)
);
CREATE INDEX idx_sections_parent ON knowledge_sections(knowledge_point_id,parent_id,status,sort_order);
CREATE TABLE user_section_progress (
 user_id BIGINT NOT NULL,
 section_id BIGINT NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
 started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 last_accessed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 completed_at DATETIME(3),
 PRIMARY KEY(user_id,section_id),
 FOREIGN KEY(user_id) REFERENCES app_users(id),
 FOREIGN KEY(section_id) REFERENCES knowledge_sections(id),
 CHECK (status IN ('IN_PROGRESS','COMPLETED')),
 CHECK ((status = 'COMPLETED' AND completed_at IS NOT NULL) OR (status = 'IN_PROGRESS' AND completed_at IS NULL))
);
CREATE INDEX idx_progress_recent ON user_section_progress(user_id,last_accessed_at);
