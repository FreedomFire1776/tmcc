CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS orbit_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  owner_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orbit_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_object_id uuid NOT NULL REFERENCES orbit_objects(id),
  target_object_id uuid NOT NULL REFERENCES orbit_objects(id),
  relationship_type text NOT NULL,
  assertion_mode text NOT NULL CHECK (assertion_mode IN ('explicit', 'inferred', 'suggested')),
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orbit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  object_id uuid REFERENCES orbit_objects(id),
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orbit_objects_type_idx ON orbit_objects(object_type);
CREATE INDEX IF NOT EXISTS orbit_events_object_idx ON orbit_events(object_id, occurred_at DESC);
