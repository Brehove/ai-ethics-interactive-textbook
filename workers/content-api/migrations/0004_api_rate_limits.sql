PRAGMA foreign_keys = ON;

-- Fixed-window counters are keyed by a hash of trusted actor + client identity.
-- The API uses one atomic UPSERT ... RETURNING operation and fails closed when
-- this persistence layer is unavailable.
CREATE TABLE api_rate_limits (
  subject_hash TEXT NOT NULL,
  route_class TEXT NOT NULL CHECK (route_class IN ('mutation', 'upload')),
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (subject_hash, route_class, window_start)
);
CREATE INDEX api_rate_limits_window ON api_rate_limits(window_start);
