CREATE TABLE design_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    description TEXT,
    source_tool VARCHAR(50),
    last_imported_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES design_documents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    svg_content TEXT,
    svg_layers JSONB DEFAULT '[]',
    frame_width INT,
    frame_height INT,
    breakpoint VARCHAR(20) DEFAULT 'pc',
    sort_order INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_module ON design_documents(module_id);
CREATE INDEX idx_documents_status ON design_documents(status);
CREATE INDEX idx_screens_document ON screens(document_id);
