# TMCC

**Truther Media Command Center** is a mission-driven media operating system powered by **FYRE Intelligence** and the **ORBIT Kernel**.

## Architecture

```text
TMCC User Experience
        ↓
FYRE Intelligence
        ↓
ORBIT Kernel
        ↓
Infrastructure
```

TMCC is the operator interface. FYRE Intelligence manages evidence, context, provenance, and decision support. ORBIT supplies reusable objects, relationships, events, workflows, permissions, search, and missions.

## Foundation principles

- GitHub is the canonical source of truth.
- The UI reflects kernel state; it does not own data.
- State changes produce immutable events.
- Relationships and provenance are first-class records.
- AI assists analysis but does not silently create institutional knowledge.
- Human review remains mandatory for consequential editorial decisions.

## Repository layout

- `apps/` — deployable TMCC applications
- `packages/` — reusable ORBIT, FYRE, UI, and shared packages
- `plugins/` — integrations that extend the platform without modifying the kernel
- `docs/` — architecture, decisions, specifications, and roadmap
- `infrastructure/` — deployment and environment configuration
- `tests/` — cross-package and end-to-end testing

## Current phase

**Phase 0: Architecture foundation**

The immediate objective is to formalize the platform contract before application scaffolding begins.