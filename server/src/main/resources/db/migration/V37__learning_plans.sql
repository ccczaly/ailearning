CREATE TABLE learning_plans (
    user_id BIGINT NOT NULL PRIMARY KEY,
    preferences_json LONGTEXT NOT NULL,
    started DATE NOT NULL
);
CREATE TABLE learning_plan_tasks (
    user_id BIGINT NOT NULL,
    task_order INT NOT NULL,
    section_id BIGINT NOT NULL,
    course_slug VARCHAR(128) NOT NULL,
    study_date DATE NOT NULL,
    start_minute INT NOT NULL,
    end_minute INT NOT NULL,
    part INT NOT NULL,
    parts INT NOT NULL,
    PRIMARY KEY (user_id, task_order),
    FOREIGN KEY (user_id) REFERENCES learning_plans(user_id),
    FOREIGN KEY (section_id) REFERENCES knowledge_sections(id)
);
