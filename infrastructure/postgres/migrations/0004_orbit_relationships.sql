-- ORBIT relationship graph store
CREATE TABLE IF NOT EXISTS orbit_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_object_id uuid NOT NULL,
  target_object_id uuid NOT NULL,
  relationship_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orbit_relationships_source_target_unique UNIQUE (source_object_id, target_object_id, relationship_type)
);
