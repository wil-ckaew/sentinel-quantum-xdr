ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(50)
DEFAULT 'analyst';

CREATE TABLE IF NOT EXISTS permissions (

    id UUID PRIMARY KEY
    DEFAULT uuid_generate_v4(),

    name VARCHAR(255)
    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS role_permissions (

    role VARCHAR(50)
    NOT NULL,

    permission_id UUID
    REFERENCES permissions(id),

    PRIMARY KEY(
        role,
        permission_id
    )
);
