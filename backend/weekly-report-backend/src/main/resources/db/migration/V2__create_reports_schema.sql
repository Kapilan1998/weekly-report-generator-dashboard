-- Phase 2: projects, versioned weekly reports, and the review workflow.
-- Column types are chosen to match what Hibernate 7 / MySQLDialect expects, because
-- spring.jpa.hibernate.ddl-auto=validate. See docs/PHASE2_SPEC.md for the authoritative
-- column table and the reasoning behind each type choice.

CREATE TABLE projects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NULL,
    active BIT(1) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT uq_projects_name UNIQUE (name)
);

-- Stable identity for "this user's report for this ISO week". week_start is always
-- normalized to the Monday of the week in the service, which is what makes
-- uq_reports_user_week a real one-report-per-week constraint.
-- There is intentionally no current_version_id pointer: it would create a circular FK
-- with report_versions, and InnoDB handles cascades inside an FK cycle unreliably.
-- The current version is MAX(version_number) for the report.
CREATE TABLE reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    last_submitted_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT uq_reports_user_week UNIQUE (user_id, week_start),
    CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_reports_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT chk_reports_week_range CHECK (week_end >= week_start)
);

CREATE INDEX idx_reports_status_week ON reports (status, week_start);
CREATE INDEX idx_reports_week_start ON reports (week_start);
CREATE INDEX idx_reports_project_week ON reports (project_id, week_start);

-- submitted_at IS NULL  -> the open, editable working copy
-- submitted_at NOT NULL -> a frozen snapshot; no code path ever updates it or its children
CREATE TABLE report_versions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id BIGINT NOT NULL,
    version_number INT NOT NULL,
    tasks_planned_next_week VARCHAR(4000) NULL,
    notes VARCHAR(4000) NULL,
    links VARCHAR(1000) NULL,
    submitted_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT uq_report_versions_report_number UNIQUE (report_id, version_number),
    CONSTRAINT fk_report_versions_report FOREIGN KEY (report_id)
        REFERENCES reports (id) ON DELETE CASCADE,
    CONSTRAINT chk_report_versions_number CHECK (version_number >= 1)
);

-- The task-level table the brief mandates. Hangs off a VERSION, never off the report, so
-- a frozen version keeps its exact original rows after a correction cycle.
CREATE TABLE task_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_version_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    planned_percent INT NOT NULL,
    actual_percent INT NOT NULL,
    time_planned_hours DECIMAL(5,2) NOT NULL,
    time_spent_hours DECIMAL(5,2) NOT NULL,
    output_deliverable VARCHAR(500) NULL,
    CONSTRAINT fk_task_entries_version FOREIGN KEY (report_version_id)
        REFERENCES report_versions (id) ON DELETE CASCADE,
    CONSTRAINT chk_task_entries_planned_percent CHECK (planned_percent BETWEEN 0 AND 100),
    CONSTRAINT chk_task_entries_actual_percent CHECK (actual_percent BETWEEN 0 AND 100)
);

CREATE INDEX idx_task_entries_version ON task_entries (report_version_id, display_order);

CREATE TABLE blockers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_version_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    description VARCHAR(1000) NOT NULL,
    key_issue BIT(1) NOT NULL,
    CONSTRAINT fk_blockers_version FOREIGN KEY (report_version_id)
        REFERENCES report_versions (id) ON DELETE CASCADE
);

CREATE INDEX idx_blockers_version ON blockers (report_version_id, display_order);

CREATE TABLE achievements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_version_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    description VARCHAR(1000) NOT NULL,
    key_achievement BIT(1) NOT NULL,
    CONSTRAINT fk_achievements_version FOREIGN KEY (report_version_id)
        REFERENCES report_versions (id) ON DELETE CASCADE
);

CREATE INDEX idx_achievements_version ON achievements (report_version_id, display_order);

-- Optional per the brief. One row per task type; ordering comes from the TaskType enum.
CREATE TABLE hours_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_version_id BIGINT NOT NULL,
    task_type VARCHAR(20) NOT NULL,
    hours DECIMAL(5,2) NOT NULL,
    CONSTRAINT fk_hours_entries_version FOREIGN KEY (report_version_id)
        REFERENCES report_versions (id) ON DELETE CASCADE
);

CREATE INDEX idx_hours_entries_version ON hours_entries (report_version_id);

-- Attached to the specific version it was written against, which is what lets a manager
-- see which version a given comment belongs to.
-- created_at is DATETIME(6): at plain second resolution, two review actions in the same
-- second (a double-click, or a seed script) make "latest comment" non-deterministic.
CREATE TABLE review_comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_version_id BIGINT NOT NULL,
    reviewer_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL,
    comment VARCHAR(2000) NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_review_comments_version FOREIGN KEY (report_version_id)
        REFERENCES report_versions (id) ON DELETE CASCADE,
    CONSTRAINT fk_review_comments_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id),
    CONSTRAINT chk_review_comments_change_request
        CHECK (action <> 'REQUEST_CHANGES' OR CHAR_LENGTH(TRIM(comment)) > 0)
);

CREATE INDEX idx_review_comments_version ON review_comments (report_version_id, created_at);

-- Seed categories. Without at least one project there is no valid projectId in the system,
-- so no report could be created and Phase 2 would not be reachable end to end.
INSERT INTO projects (name, description, active, created_at) VALUES
    ('Client A',         'Client A delivery work',            b'1', NOW(6)),
    ('Internal Tooling', 'Internal tools and automation',     b'1', NOW(6)),
    ('R&D',              'Research and prototyping',          b'1', NOW(6)),
    ('Marketing',        'Marketing site and campaigns',      b'1', NOW(6)),
    ('Support',          'Customer support and maintenance',  b'1', NOW(6));
