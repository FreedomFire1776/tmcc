-- ORBIT object store
CREATE TABLE IF NOT EXISTS orbit_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  owner_id uuid NULL,
  classification text NULL,
  tags text[] NOT NULL DEFAULT array[]::text[],
  labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
