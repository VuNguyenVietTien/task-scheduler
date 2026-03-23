CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    custom_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    component_type VARCHAR(100),
    data_type VARCHAR(100),
    display_logic TEXT,
    position JSONB NOT NULL,
    svg_element_id VARCHAR(255),
    descriptions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(screen_id, custom_id)
);

CREATE TABLE field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    db_table VARCHAR(255) NOT NULL,
    db_column VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_components_screen ON components(screen_id);
CREATE INDEX idx_field_mappings_component ON field_mappings(component_id);
CREATE INDEX idx_field_mappings_table_col ON field_mappings(db_table, db_column);
