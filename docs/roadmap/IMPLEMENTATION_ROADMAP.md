# TMCC Implementation Roadmap

## Phase 0 — Foundation

- Establish GitHub as canonical source of truth.
- Define architecture boundaries and engineering laws.
- Create initial repository layout and review workflow.

Exit condition: approved foundation pull request.

## Phase 1 — Platform contracts

- Finalize ORBIT engine interfaces.
- Finalize FYRE evidence and review model.
- Define domain schema and event naming rules.
- Establish ADR process and development constitution.

Exit condition: versioned contracts sufficient to scaffold code without inventing architecture during implementation.

## Phase 2 — Monorepo and infrastructure scaffold

- TypeScript workspace and package boundaries.
- Next.js TMCC application shell.
- Backend API service.
- PostgreSQL migrations.
- Local Docker development environment.
- Linting, testing, type checking, and CI.

Exit condition: one command starts a tested local system.

## Phase 3 — ORBIT minimum viable kernel

- Object CRUD with version control.
- Typed relationships.
- Append-only events.
- Basic workflow transitions.
- Workspace-scoped permissions.
- Unified basic search.
- Mission definition and activation.

Exit condition: end-to-end kernel scenario passes through API and UI.

## Phase 4 — FYRE minimum viable intelligence

- Source registry.
- Evidence ingestion and storage metadata.
- Claims and claim-evidence links.
- Contradiction visibility.
- Confidence dimensions.
- Human review queue.
- Provenance traversal.

Exit condition: an operator can build and review a traceable evidence package.

## Phase 5 — TMCC operational alpha

- Ready Room.
- Story and investigation workspaces.
- Evidence queue.
- Mission-driven navigation.
- Production and publishing readiness views.
- Retool internal operations console against public APIs.

Exit condition: a small operator team can execute a controlled editorial workflow.

## Phase 6 — Integrations and hardening

- OBS and broadcast events.
- Publishing adapters.
- Notifications.
- Observability, backups, audit review, security testing, and disaster recovery.

Exit condition: documented production-readiness review.

## Delivery rules

- Every phase has explicit exit conditions.
- Features originate as issues and land through reviewed pull requests.
- Architectural changes require ADRs.
- No production deployment without migration, rollback, and observability plans.
- AI-generated implementation is reviewed under the same standards as human-generated implementation.
