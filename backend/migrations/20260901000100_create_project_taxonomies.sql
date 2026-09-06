-- Project taxonomies (project scheduling & WBS increment 1, task 1.1).
--
-- Project-scoped phase/category terms with translations, and nullable
-- project-scoped task references. A phase/category row is pure taxonomy:
-- it carries no effort, progress, dates, assignee, parent, dependency,
-- meeting, or allocation semantics (see design doc §4.2).
--
-- Forward-only, idempotent seed:
--  * existing projects are backfilled below;
--  * new projects are seeded by trigger seed_default_project_phases().

BEGIN;

CREATE TABLE IF NOT EXISTS project_phases (
    phase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    phase_key TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    color TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_phases_project_key_unique UNIQUE (project_id, phase_key),
    CONSTRAINT project_phases_project_order_unique UNIQUE (project_id, display_order),
    CONSTRAINT project_phases_project_id_unique UNIQUE (project_id, phase_id)
);

CREATE TABLE IF NOT EXISTS project_phase_translations (
    phase_id UUID NOT NULL REFERENCES project_phases(phase_id) ON DELETE CASCADE,
    locale TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_phase_translations_phase_locale_unique UNIQUE (phase_id, locale)
);

CREATE TABLE IF NOT EXISTS project_categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    category_key TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    color TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_categories_project_key_unique UNIQUE (project_id, category_key),
    CONSTRAINT project_categories_project_order_unique UNIQUE (project_id, display_order),
    CONSTRAINT project_categories_project_id_unique UNIQUE (project_id, category_id)
);

CREATE TABLE IF NOT EXISTS project_category_translations (
    category_id UUID NOT NULL REFERENCES project_categories(category_id) ON DELETE CASCADE,
    locale TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_category_translations_category_locale_unique UNIQUE (category_id, locale)
);

-- Nullable task attributes; composite FKs make the reference project-scoped
-- (a term of ANOTHER project can never satisfy them). NULL = Unphased /
-- uncategorised; the free-text tasks.category column stays untouched.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS phase_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE tasks ADD CONSTRAINT tasks_phase_project_fk
    FOREIGN KEY (project_id, phase_id) REFERENCES project_phases(project_id, phase_id);
ALTER TABLE tasks ADD CONSTRAINT tasks_category_project_fk
    FOREIGN KEY (project_id, category_id) REFERENCES project_categories(project_id, category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_phase_id ON tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);

-- Default phase seed data: exactly five keys, in this order, with the
-- accepted ja/en/vi labels (design doc §4.1). Labels are never identifiers.
-- Backfill every existing project; re-runs are no-ops (ON CONFLICT DO NOTHING).
WITH new_phases AS (
    INSERT INTO project_phases (project_id, phase_key, display_order)
    SELECT p.project_id, seed.key, seed.ord
    FROM projects p
    CROSS JOIN (VALUES
        ('creation', 1),
        ('try-s-review-1', 2),
        ('address-review-comments-1', 3),
        ('try-s-review-2', 4),
        ('toshiba-review', 5)
    ) AS seed(key, ord)
    ON CONFLICT DO NOTHING
    RETURNING phase_id, phase_key
)
INSERT INTO project_phase_translations (phase_id, locale, name)
SELECT np.phase_id, labels.locale, labels.name
FROM new_phases np
JOIN (VALUES
    ('creation', 'ja', '作成'),
    ('creation', 'en', 'Creation'),
    ('creation', 'vi', 'Tạo tài liệu'),
    ('try-s-review-1', 'ja', 'Try-Sレビュー①'),
    ('try-s-review-1', 'en', 'Try-S Review 1'),
    ('try-s-review-1', 'vi', 'Đánh giá Try-S lần 1'),
    ('address-review-comments-1', 'ja', '指摘修正①'),
    ('address-review-comments-1', 'en', 'Address Review Comments 1'),
    ('address-review-comments-1', 'vi', 'Sửa theo góp ý lần 1'),
    ('try-s-review-2', 'ja', 'Try-Sレビュー②'),
    ('try-s-review-2', 'en', 'Try-S Review 2'),
    ('try-s-review-2', 'vi', 'Đánh giá Try-S lần 2'),
    ('toshiba-review', 'ja', '東芝レビュー'),
    ('toshiba-review', 'en', 'Toshiba Review'),
    ('toshiba-review', 'vi', 'Đánh giá Toshiba')
) AS labels(key, locale, name) ON labels.key = np.phase_key
ON CONFLICT DO NOTHING;

-- New projects receive the same five phases automatically.
CREATE OR REPLACE FUNCTION seed_default_project_phases() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    WITH new_phases AS (
        INSERT INTO project_phases (project_id, phase_key, display_order)
        SELECT NEW.project_id, seed.key, seed.ord
        FROM (VALUES
            ('creation', 1),
            ('try-s-review-1', 2),
            ('address-review-comments-1', 3),
            ('try-s-review-2', 4),
            ('toshiba-review', 5)
        ) AS seed(key, ord)
        ON CONFLICT DO NOTHING
        RETURNING phase_id, phase_key
    )
    INSERT INTO project_phase_translations (phase_id, locale, name)
    SELECT np.phase_id, labels.locale, labels.name
    FROM new_phases np
    JOIN (VALUES
        ('creation', 'ja', '作成'),
        ('creation', 'en', 'Creation'),
        ('creation', 'vi', 'Tạo tài liệu'),
        ('try-s-review-1', 'ja', 'Try-Sレビュー①'),
        ('try-s-review-1', 'en', 'Try-S Review 1'),
        ('try-s-review-1', 'vi', 'Đánh giá Try-S lần 1'),
        ('address-review-comments-1', 'ja', '指摘修正①'),
        ('address-review-comments-1', 'en', 'Address Review Comments 1'),
        ('address-review-comments-1', 'vi', 'Sửa theo góp ý lần 1'),
        ('try-s-review-2', 'ja', 'Try-Sレビュー②'),
        ('try-s-review-2', 'en', 'Try-S Review 2'),
        ('try-s-review-2', 'vi', 'Đánh giá Try-S lần 2'),
        ('toshiba-review', 'ja', '東芝レビュー'),
        ('toshiba-review', 'en', 'Toshiba Review'),
        ('toshiba-review', 'vi', 'Đánh giá Toshiba')
    ) AS labels(key, locale, name) ON labels.key = np.phase_key
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_seed_default_phases ON projects;
CREATE TRIGGER projects_seed_default_phases
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION seed_default_project_phases();

COMMIT;
