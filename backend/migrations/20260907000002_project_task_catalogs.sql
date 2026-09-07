-- Project-local normal task classification catalogs. This deliberately leaves
-- project_phases/project_categories and tasks.phase_id/category_id as their
-- distinct WBS taxonomy domain.
BEGIN;

CREATE TABLE project_task_catalog_items (
    catalog_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('PROGRESS_TYPE', 'CATEGORY', 'TASK_TYPE')),
    display_order INTEGER NOT NULL,
    -- Private compatibility bridge for rows seeded from legacy task scalars.
    legacy_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_task_catalog_items_project_item_key UNIQUE (project_id, catalog_item_id),
    CONSTRAINT project_task_catalog_items_project_kind_order_key
        UNIQUE (project_id, kind, display_order) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE UNIQUE INDEX project_task_catalog_items_legacy_value_key
    ON project_task_catalog_items(project_id, kind, legacy_value)
    WHERE legacy_value IS NOT NULL;
CREATE INDEX project_task_catalog_items_project_kind_order_index
    ON project_task_catalog_items(project_id, kind, display_order, catalog_item_id);

CREATE TABLE project_task_catalog_labels (
    catalog_item_id UUID NOT NULL REFERENCES project_task_catalog_items(catalog_item_id) ON DELETE CASCADE,
    locale TEXT NOT NULL,
    name TEXT NOT NULL,
    CONSTRAINT project_task_catalog_labels_item_locale_key PRIMARY KEY (catalog_item_id, locale),
    CONSTRAINT project_task_catalog_labels_locale_nonempty CHECK (length(btrim(locale)) > 0),
    CONSTRAINT project_task_catalog_labels_name_nonempty CHECK (length(btrim(name)) > 0)
);

ALTER TABLE tasks ADD COLUMN progress_catalog_item_id UUID;
ALTER TABLE tasks ADD COLUMN category_catalog_item_id UUID;
ALTER TABLE tasks ADD COLUMN task_type_catalog_item_id UUID;
ALTER TABLE tasks ADD CONSTRAINT tasks_progress_catalog_item_project_fk
    FOREIGN KEY (project_id, progress_catalog_item_id)
    REFERENCES project_task_catalog_items(project_id, catalog_item_id);
ALTER TABLE tasks ADD CONSTRAINT tasks_category_catalog_item_project_fk
    FOREIGN KEY (project_id, category_catalog_item_id)
    REFERENCES project_task_catalog_items(project_id, catalog_item_id);
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_catalog_item_project_fk
    FOREIGN KEY (project_id, task_type_catalog_item_id)
    REFERENCES project_task_catalog_items(project_id, catalog_item_id);
CREATE INDEX idx_tasks_progress_catalog_item_id ON tasks(progress_catalog_item_id);
CREATE INDEX idx_tasks_category_catalog_item_id ON tasks(category_catalog_item_id);
CREATE INDEX idx_tasks_task_type_catalog_item_id ON tasks(task_type_catalog_item_id);

-- A composite FK prevents cross-project IDs. This deferred constraint trigger
-- supplies the second invariant: each task slot accepts only its own kind.
CREATE OR REPLACE FUNCTION validate_task_catalog_item_kinds()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.progress_catalog_item_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM project_task_catalog_items
        WHERE catalog_item_id = NEW.progress_catalog_item_id
          AND project_id = NEW.project_id AND kind = 'PROGRESS_TYPE'
    ) THEN
        RAISE EXCEPTION 'progress catalog item must be a same-project PROGRESS_TYPE';
    END IF;
    IF NEW.category_catalog_item_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM project_task_catalog_items
        WHERE catalog_item_id = NEW.category_catalog_item_id
          AND project_id = NEW.project_id AND kind = 'CATEGORY'
    ) THEN
        RAISE EXCEPTION 'category catalog item must be a same-project CATEGORY';
    END IF;
    IF NEW.task_type_catalog_item_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM project_task_catalog_items
        WHERE catalog_item_id = NEW.task_type_catalog_item_id
          AND project_id = NEW.project_id AND kind = 'TASK_TYPE'
    ) THEN
        RAISE EXCEPTION 'task type catalog item must be a same-project TASK_TYPE';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER tasks_catalog_item_kind_check
AFTER INSERT OR UPDATE OF project_id, progress_catalog_item_id,
    category_catalog_item_id, task_type_catalog_item_id ON tasks
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION validate_task_catalog_item_kinds();

-- Seed only extant nonblank legacy values. Legacy bytes remain on tasks and
-- plan JSON is intentionally untouched; no phase/category taxonomy inference.
INSERT INTO project_task_catalog_items (project_id, kind, display_order, legacy_value)
SELECT project_id, 'PROGRESS_TYPE', row_number() OVER (
    PARTITION BY project_id ORDER BY legacy_value
) - 1, legacy_value
FROM (
    SELECT DISTINCT project_id, progress_type::text AS legacy_value
    FROM tasks
    WHERE progress_type IS NOT NULL
) values_to_seed;

INSERT INTO project_task_catalog_items (project_id, kind, display_order, legacy_value)
SELECT project_id, 'CATEGORY', row_number() OVER (
    PARTITION BY project_id ORDER BY legacy_value
) - 1, legacy_value
FROM (
    SELECT DISTINCT project_id, category AS legacy_value
    FROM tasks
    WHERE category IS NOT NULL AND btrim(category) <> ''
) values_to_seed;

INSERT INTO project_task_catalog_items (project_id, kind, display_order, legacy_value)
SELECT project_id, 'TASK_TYPE', row_number() OVER (
    PARTITION BY project_id ORDER BY legacy_value
) - 1, legacy_value
FROM (
    SELECT DISTINCT project_id, type AS legacy_value
    FROM tasks
    WHERE type IS NOT NULL AND btrim(type) <> ''
) values_to_seed;

INSERT INTO project_task_catalog_labels (catalog_item_id, locale, name)
SELECT catalog_item_id, 'en', btrim(legacy_value)
FROM project_task_catalog_items
WHERE legacy_value IS NOT NULL;

UPDATE tasks AS t
SET progress_catalog_item_id = item.catalog_item_id
FROM project_task_catalog_items AS item
WHERE item.project_id = t.project_id AND item.kind = 'PROGRESS_TYPE'
  AND item.legacy_value = t.progress_type::text;
UPDATE tasks AS t
SET category_catalog_item_id = item.catalog_item_id
FROM project_task_catalog_items AS item
WHERE item.project_id = t.project_id AND item.kind = 'CATEGORY'
  AND item.legacy_value = t.category;
UPDATE tasks AS t
SET task_type_catalog_item_id = item.catalog_item_id
FROM project_task_catalog_items AS item
WHERE item.project_id = t.project_id AND item.kind = 'TASK_TYPE'
  AND item.legacy_value = t.type;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM project_task_catalog_items item
        LEFT JOIN project_task_catalog_labels label USING (catalog_item_id)
        WHERE label.catalog_item_id IS NULL
    ) THEN
        RAISE EXCEPTION 'project task catalog item has no label';
    END IF;
END $$;

COMMIT;
