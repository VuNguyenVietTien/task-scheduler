CREATE INDEX idx_components_position_gin ON components USING gin(position jsonb_path_ops);
CREATE INDEX idx_components_descriptions_gin ON components USING gin(descriptions jsonb_path_ops);
CREATE INDEX idx_components_metadata_gin ON components USING gin(metadata jsonb_path_ops);
CREATE INDEX idx_screens_metadata_gin ON screens USING gin(metadata jsonb_path_ops);
CREATE INDEX idx_screens_svg_layers_gin ON screens USING gin(svg_layers jsonb_path_ops);
