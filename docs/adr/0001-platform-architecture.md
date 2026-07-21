# ADR 0001: Adopt TMCC / FYRE / ORBIT Layered Architecture

- Status: Accepted
- Date: 2026-07-20

## Context

TMCC must support media operations, evidence-centered intelligence, reusable platform primitives, integrations, and future applications without collapsing all responsibilities into one codebase or UI.

## Decision

Adopt four explicit layers:

1. **TMCC** — mission-oriented user experience and operational applications.
2. **FYRE Intelligence** — evidence, claims, provenance, context, review, and decision support.
3. **ORBIT Kernel** — objects, relationships, events, workflows, search, permissions, and missions.
4. **Infrastructure** — database, queues, storage, deployment, observability, and external services.

Dependencies point downward. Upper layers may use published contracts from lower layers. Lower layers do not import TMCC-specific presentation or editorial logic.

## Consequences

### Positive

- Kernel capabilities remain reusable.
- Evidence and operational state remain distinguishable.
- Plugins can extend the platform through contracts.
- UI replacement does not require replacing domain state.
- Architecture reviews can identify boundary violations.

### Costs

- More explicit interfaces and schemas are required.
- Cross-layer shortcuts are prohibited even when initially faster.
- Some features require coordinated changes across layers.

## Enforcement

Pull requests that introduce upward dependencies, hidden canonical UI state, direct plugin database writes, or unreviewed AI institutionalization require rejection or a superseding ADR.
