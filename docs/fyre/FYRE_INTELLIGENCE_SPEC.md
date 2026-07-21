# FYRE Intelligence Specification

## Purpose

FYRE Intelligence transforms collected material into traceable, reviewable decision support while preserving uncertainty, contradiction, provenance, and human authority.

## Information lifecycle

```text
Noise → Signal → Observation → Evidence → Knowledge → Context → Decision Support → Institutional Memory
```

The system must not skip directly from raw material to asserted truth.

## Core records

### Source
A person, organization, system, publication, document, feed, sensor, or repository from which material originates.

### Observation
A bounded statement describing what was collected or noticed without claiming that it is true.

### Evidence
A preserved artifact or record that can support, weaken, or contradict a claim.

Required evidence fields:

- source reference
- captured timestamp
- collection method
- original location
- content hash where applicable
- chain of custody
- verification status
- access classification
- provenance links

### Claim
A reviewable proposition that evidence may support, contradict, or leave unresolved.

### Knowledge Record
A human-reviewed synthesis derived from claims and evidence. Knowledge records retain links to all supporting and contradicting material.

### Context Record
A connection between knowledge and operational objects such as stories, investigations, people, organizations, episodes, locations, and missions.

### Decision-Support Record
A time-bound analytical output presenting:

- known information
- supporting evidence
- contradicting evidence
- unresolved gaps
- alternative explanations
- confidence dimensions
- recommended collection or review steps

## Confidence dimensions

FYRE does not use one universal truth score. It records separate dimensions:

- source reliability
- evidence completeness
- corroboration
- recency
- chain-of-custody quality
- reviewer status
- inference distance

These dimensions may be displayed together but must remain independently inspectable.

## Contradiction handling

Contradictory evidence is retained and surfaced. The system must not delete, suppress, or average away material merely because it conflicts with an existing assessment.

## Entity resolution

FYRE may suggest that multiple names or identifiers refer to the same entity. Suggested merges require review. Original source wording and identifiers remain preserved after resolution.

## Relationship assertion modes

- **Explicit** — directly stated or documented by a source.
- **Inferred** — analytically derived from documented facts.
- **Suggested** — machine- or operator-generated hypothesis requiring review.

The interface must make these modes visually distinct.

## Human boundary

AI may extract, classify, compare, summarize, suggest relationships, identify contradictions, and propose next steps. AI may not silently:

- approve evidence
- verify claims
- merge entities
- publish editorial conclusions
- create institutional knowledge
- alter provenance history

Consequential transitions require an attributable human review event.

## Institutional memory

Approved knowledge records become reusable institutional memory. Superseding analysis links to prior records rather than erasing them. Historical conclusions remain visible with their evidence, context, confidence, and review state.
