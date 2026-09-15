CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ASSETS
-- ============================================================

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    hostname VARCHAR(255) NOT NULL,

    ip_address VARCHAR(50),

    operating_system VARCHAR(255),

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    criticality VARCHAR(50) NOT NULL DEFAULT 'medium',

    risk_score INTEGER NOT NULL DEFAULT 0,

    mac_address VARCHAR(100),

    agent_version VARCHAR(100),

    last_seen TIMESTAMP,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_tenant
ON assets(tenant_id);

CREATE INDEX IF NOT EXISTS idx_assets_hostname
ON assets(hostname);

CREATE INDEX IF NOT EXISTS idx_assets_status
ON assets(status);

CREATE INDEX IF NOT EXISTS idx_assets_risk
ON assets(risk_score);


-- ============================================================
-- ENDPOINTS
-- ============================================================

CREATE TABLE IF NOT EXISTS endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    asset_id UUID
        REFERENCES assets(id)
        ON DELETE CASCADE,

    agent_id VARCHAR(255),

    agent_version VARCHAR(100),

    platform VARCHAR(100),

    platform_version VARCHAR(100),

    hostname VARCHAR(255),

    ip_address VARCHAR(50),

    status VARCHAR(50) NOT NULL DEFAULT 'online',

    risk_score INTEGER NOT NULL DEFAULT 0,

    last_seen TIMESTAMP,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_endpoints_tenant
ON endpoints(tenant_id);

CREATE INDEX IF NOT EXISTS idx_endpoints_asset
ON endpoints(asset_id);

CREATE INDEX IF NOT EXISTS idx_endpoints_agent
ON endpoints(agent_id);

CREATE INDEX IF NOT EXISTS idx_endpoints_risk
ON endpoints(risk_score);


-- ============================================================
-- INCIDENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    asset_id UUID
        REFERENCES assets(id)
        ON DELETE SET NULL,

    endpoint_id UUID
        REFERENCES endpoints(id)
        ON DELETE SET NULL,

    title VARCHAR(500) NOT NULL,

    description TEXT,

    severity VARCHAR(50) NOT NULL DEFAULT 'medium',

    status VARCHAR(50) NOT NULL DEFAULT 'open',

    category VARCHAR(100),

    source VARCHAR(100),

    assigned_to UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    detected_at TIMESTAMP NOT NULL DEFAULT NOW(),

    resolved_at TIMESTAMP,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant
ON incidents(tenant_id);

CREATE INDEX IF NOT EXISTS idx_incidents_status
ON incidents(status);

CREATE INDEX IF NOT EXISTS idx_incidents_severity
ON incidents(severity);

CREATE INDEX IF NOT EXISTS idx_incidents_asset
ON incidents(asset_id);

CREATE INDEX IF NOT EXISTS idx_incidents_created
ON incidents(created_at DESC);


-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    tenant_id UUID
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(255) NOT NULL,

    resource VARCHAR(255),

    resource_id UUID,

    ip_address VARCHAR(50),

    user_agent TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant
ON audit_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_user
ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_created
ON audit_logs(created_at DESC);


-- ============================================================
-- SECURITY EVENTS / SIEM
-- ============================================================

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    tenant_id UUID
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    source VARCHAR(255) NOT NULL,

    source_ip VARCHAR(50),

    hostname VARCHAR(255),

    severity VARCHAR(50) NOT NULL DEFAULT 'low',

    event_type VARCHAR(150) NOT NULL,

    category VARCHAR(100),

    message TEXT,

    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    correlation_id UUID,

    processed BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_tenant
ON security_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_security_events_severity
ON security_events(severity);

CREATE INDEX IF NOT EXISTS idx_security_events_type
ON security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_security_events_created
ON security_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_processed
ON security_events(processed);


-- ============================================================
-- THREAT INTELLIGENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS threat_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    tenant_id UUID
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    indicator_type VARCHAR(50) NOT NULL,

    indicator_value VARCHAR(1000) NOT NULL,

    threat_type VARCHAR(100),

    severity VARCHAR(50) NOT NULL DEFAULT 'medium',

    confidence INTEGER NOT NULL DEFAULT 50,

    source VARCHAR(255),

    description TEXT,

    tags JSONB NOT NULL DEFAULT '[]'::jsonb,

    first_seen TIMESTAMP,

    last_seen TIMESTAMP,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(indicator_type, indicator_value)
);

CREATE INDEX IF NOT EXISTS idx_threat_indicators_value
ON threat_indicators(indicator_value);

CREATE INDEX IF NOT EXISTS idx_threat_indicators_type
ON threat_indicators(indicator_type);

CREATE INDEX IF NOT EXISTS idx_threat_indicators_active
ON threat_indicators(active);


-- ============================================================
-- INCIDENT EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS incident_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    incident_id UUID NOT NULL
        REFERENCES incidents(id)
        ON DELETE CASCADE,

    security_event_id UUID
        REFERENCES security_events(id)
        ON DELETE SET NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_events_incident
ON incident_events(incident_id);
