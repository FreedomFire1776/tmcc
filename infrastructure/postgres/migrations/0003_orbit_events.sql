-- ORBIT append-only event store
CREATE TABLE IF NOT EXISTS orbit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_version integer NOT NULL,
  actor_id uuid NULL,
  correlation_id uuid NULL,
  causation_id uuid NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
