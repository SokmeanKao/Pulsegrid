-- Pulsegrid v2.1 schema
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS servers (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    grpc_host     TEXT NOT NULL,
    grpc_port     INT  NOT NULL,
    environment   TEXT NOT NULL DEFAULT '',
    tags          JSONB NOT NULL DEFAULT '[]'::jsonb,
    hostname      TEXT,
    os            TEXT,
    architecture  TEXT,
    agent_version TEXT,
    first_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_samples (
    time       TIMESTAMPTZ NOT NULL,
    server_id  TEXT NOT NULL REFERENCES servers(id),
    sequence   BIGINT NOT NULL,
    payload    JSONB NOT NULL
);

SELECT create_hypertable('metric_samples', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_metric_samples_server_time
    ON metric_samples (server_id, time DESC);
