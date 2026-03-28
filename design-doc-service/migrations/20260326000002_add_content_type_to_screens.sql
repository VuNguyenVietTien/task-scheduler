-- Add content_type column to screens table to distinguish SVG vs image content
ALTER TABLE screens ADD COLUMN content_type VARCHAR(10) NOT NULL DEFAULT 'svg';
