CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE tenants (

    id UUID PRIMARY KEY
        DEFAULT uuid_generate_v4(),

    name VARCHAR(255)
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT NOW()
);

CREATE TABLE users (

    id UUID PRIMARY KEY
        DEFAULT uuid_generate_v4(),

    tenant_id UUID
        REFERENCES tenants(id),

    email VARCHAR(255)
        UNIQUE NOT NULL,

    password_hash TEXT
        NOT NULL,

    role VARCHAR(50)
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT NOW()
);

CREATE TABLE refresh_tokens (

    id UUID PRIMARY KEY
        DEFAULT uuid_generate_v4(),

    user_id UUID
        REFERENCES users(id),

    token TEXT
        NOT NULL,

    expires_at TIMESTAMP
        NOT NULL
);
