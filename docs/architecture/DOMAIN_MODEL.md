# Initial Domain and Database Model

## Design goals

The initial persistence model uses PostgreSQL and preserves a path toward graph and search specialization without making either a day-one dependency.

## Core tables

### objects

Canonical record for every ORBIT object.

| Column | Purpose |
|---|---|
| `id` UUID | Stable identity |
| `object_type` TEXT | Controlled type |
| `title` TEXT | Display title |
| `status` TEXT | Lifecycle state |
| `owner_id` UUID | Responsible actor or team |
| `workspace_id` UUID | Tenant/workspace boundary |
| `metadata` JSONB | Governed extensions |
| `version` INTEGER | Optimistic concurrency |
| `created_at` TIMESTAMPTZ | Creation time |
| `updated_at` TIMESTAMPTZ | Last update time |

### relationships

Typed object-to-object connections.

| Column | Purpose |
|---|---|
| `id` UUID | Relationship identity |
| `source_object_id` UUID | Origin |
| `target_object_id` UUID | Destination |
| `relationship_type` TEXT | Controlled predicate |
| `assertion_mode` TEXT | explicit, inferred, suggested |
| `provenance_object_id` UUID | Source/provenance record |
| `confidence` JSONB | Independent confidence dimensions |
| `status` TEXT | proposed, active, rejected, superseded |
| timestamps | Audit history |

### events

Append-only event log.

| Column | Purpose |
|---|---|
| `id` UUID | Event identity |
| `event_type` TEXT | Controlled event name |
| `subject_object_id` UUID | Primary subject |
| `actor_id` UUID | Responsible actor |
| `workspace_id` UUID | Security boundary |
| `mission_id` UUID | Optional operational context |
| `causation_id` UUID | Triggering event/command |
| `correlation_id` UUID | End-to-end operation |
| `payload` JSONB | Event-specific data |
| `occurred_at` TIMESTAMPTZ | Domain time |
| `recorded_at` TIMESTAMPTZ | Persistence time |

### workflow_definitions

Versioned workflow configuration.

Fields include identifier, name, version, states, transitions, guards, required roles, required evidence, and activation status.

### workflow_instances

Binds a workflow definition version to an object and tracks current state, assignments, deadlines, and transition history.

### sources

Source identity, category, ownership, reliability assessments, access restrictions, and aliases.

### evidence

Preserved artifact metadata, collection method, source, capture time, original location, content hash, chain of custody, verification state, and storage pointer.

### claims

Reviewable propositions with lifecycle state, author, scope, and temporal boundaries.

### claim_evidence

Many-to-many link that records whether evidence supports, contradicts, contextualizes, or is neutral toward a claim.

### reviews

Attributable human or automated review records. Automated reviews cannot satisfy fields requiring human authorization.

### permissions

Role and policy assignments scoped by organization, workspace, mission, object type, or object.

## Initial indexes

- object type + status
- workspace + updated time
- relationship source/type and target/type
- event subject + occurred time
- event correlation ID
- evidence source + capture time
- claims status + updated time
- GIN indexes for governed JSONB fields
- PostgreSQL full-text vector for permitted searchable text

## Security boundary

Every tenant-owned record carries a workspace or organization boundary. Application queries must apply authorization filters before returning records. Search indexes and background jobs must preserve the same boundary.

## Migration policy

Database changes are forward-only migrations in normal development. Destructive migrations require an architecture decision record, backup plan, data validation procedure, and rollback strategy.
