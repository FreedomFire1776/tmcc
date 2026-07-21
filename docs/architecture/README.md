# TMCC System Architecture

## Layer model

### 1. TMCC
The mission-oriented operator experience for research, production, broadcast, publishing, and archive work.

### 2. FYRE Intelligence
The knowledge layer responsible for evidence, claims, entities, timelines, provenance, confidence dimensions, contradiction visibility, and human-reviewed decision support.

### 3. ORBIT Kernel
The reusable platform kernel. Its permanent engines are:

1. Object Engine
2. Relationship Engine
3. Event Engine
4. Workflow Engine
5. Search Engine
6. Permission Engine
7. Mission Engine

Everything outside these permanent responsibilities is implemented as an application or plugin.

### 4. Infrastructure
PostgreSQL, object storage, queues, cache, deployment, observability, and external services.

## Architectural laws

1. Objects contain state, not hidden business logic.
2. Relationships are typed first-class records.
3. Meaningful state changes emit immutable events.
4. Workflows are versioned configuration.
5. Plugins subscribe through published contracts and do not alter kernel internals.
6. The UI never becomes an alternate source of truth.
7. Evidence provenance must survive every transformation.
8. AI-generated conclusions require explicit review before institutionalization.

## Operational and knowledge separation

TMCC answers: **What must the operator do now?**

FYRE Intelligence answers: **What does the available evidence support, contradict, or leave unresolved?**

These states may interact, but they must not be collapsed into one model.