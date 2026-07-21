-- ORBIT lookup and performance indexes
CREATE INDEX IF NOT EXISTS idx_orbit_objects_object_type ON orbit_objects (object_type);
CREATE INDEX IF NOT EXISTS idx_orbit_objects_status ON orbit_objects (status);
CREATE INDEX IF NOT EXISTS idx_orbit_objects_owner_id ON orbit_objects (owner_id);
CREATE INDEX IF NOT EXISTS idx_orbit_objects_tags ON orbit_objects USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_orbit_objects_labels ON orbit_objects USING gin (labels);
CREATE INDEX IF NOT EXISTS idx_orbit_objects_metadata ON orbit_objects USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_orbit_relationships_source ON orbit_relationships (source_object_id);
CREATE INDEX IF NOT EXISTS idx_orbit_relationships_target ON orbit_relationships (target_object_id);
CREATE INDEX IF NOT EXISTS idx_orbit_relationships_type ON orbit_relationships (relationship_type);
CREATE INDEX IF NOT EXISTS idx_orbit_events_aggregate ON orbit_events (aggregate_id, aggregate_type);
CREATE INDEX IF NOT EXISTS idx_orbit_events_correlation ON orbit_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_orbit_events_causation ON orbit_events (causation_id);
CREATE INDEX IF NOT EXISTS idx_orbit_events_event_type ON orbit_events (event_type);
