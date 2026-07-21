# ORBIT Kernel Specification

## Purpose

ORBIT is the reusable operating kernel beneath TMCC. It provides stable platform primitives without embedding media-specific business logic.

## Permanent engines

### Object Engine
Stores universal objects with identity, type, title, status, ownership, timestamps, version, and extensible metadata.

### Relationship Engine
Stores typed, directional links between objects. Relationships are first-class records with provenance, confidence, lifecycle state, and optional temporal boundaries.

### Event Engine
Records immutable facts about meaningful state changes. Events capture actor, action, target, time, context, cause, payload, and result.

### Workflow Engine
Executes versioned workflow definitions. A workflow controls permitted transitions, guards, required evidence, assignments, deadlines, and emitted events.

### Search Engine
Provides unified discovery across object fields, metadata, relationships, events, timelines, and authorized content.

### Permission Engine
Evaluates whether an actor may perform an action against a resource within a workspace, mission, or organization context.

### Mission Engine
Assembles the operator workspace required for a mission. Missions select tools, queues, filters, roles, workflows, and views without duplicating underlying data.

## Universal object contract

Every object must include:

- `id`: UUID
- `type`: controlled object type
- `title`: human-readable label
- `status`: controlled lifecycle state
- `owner_id`: responsible actor or team
- `created_at`
- `updated_at`
- `version`: optimistic concurrency version
- `metadata`: schema-governed extension data

Objects contain state. Business rules belong in services, policies, and workflow definitions.

## Relationship contract

Every relationship must include:

- source object
- target object
- controlled relationship type
- explicit, inferred, or suggested assertion mode
- provenance reference
- confidence dimensions
- creator and timestamps
- lifecycle status

Suggested relationships are never silently promoted to verified relationships.

## Event contract

Events are append-only. Corrections create compensating events rather than modifying historical records.

Minimum fields:

- event ID
- event type
- occurred time
- recorded time
- actor
- subject object
- workspace or mission context
- causation ID
- correlation ID
- payload
- result

## Plugin boundary

Plugins may register capabilities, subscribe to published events, invoke public kernel services, and expose adapters. Plugins may not modify kernel tables or bypass permission and event policies.

Plugin lifecycle:

1. Initialize
2. Register
3. Subscribe
4. Execute
5. Shutdown

## Invariants

1. Every meaningful state change emits an event.
2. Every relationship has provenance.
3. Permission checks precede protected actions.
4. Workflow transitions are validated against a versioned definition.
5. UI state cannot become canonical domain state.
6. Plugins communicate only through published contracts.
7. Historical records are preserved through append-only or versioned mechanisms.
