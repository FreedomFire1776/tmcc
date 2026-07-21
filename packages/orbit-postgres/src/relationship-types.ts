import type { Metadata, OrbitRelationship, UUID } from '@tmcc/orbit-kernel';
import type { DomainEvent } from './domain-event.js';

export type RelationshipDirection = 'forward' | 'reverse' | 'undirected';

export interface RelationshipModel extends OrbitRelationship {
  readonly direction: RelationshipDirection;
}

export interface RelationshipLifecyclePayload {
  readonly relationshipId: UUID;
  readonly sourceObjectId: UUID;
  readonly targetObjectId: UUID;
  readonly relationshipType: string;
  readonly metadata: Readonly<Metadata>;
  readonly version: number;
}

export interface RelationshipLifecycleEvent extends DomainEvent<RelationshipLifecyclePayload> {
  readonly eventType: 'orbit.relationship.created' | 'orbit.relationship.updated' | 'orbit.relationship.removed';
  readonly aggregateId: UUID;
}
