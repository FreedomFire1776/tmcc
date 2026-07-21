import type { CreateOrbitObjectInput, OrbitObject, UpdateOrbitObjectInput, ObjectType, OrbitStatus, UUID } from '@tmcc/orbit-kernel';
import type { DomainEvent } from './domain-event.js';

export interface ObjectLifecycle {
  create(input: CreateOrbitObjectInput): Promise<OrbitObject>;
  update(id: UUID, input: UpdateOrbitObjectInput): Promise<OrbitObject>;
  delete(id: UUID, expectedVersion: number): Promise<OrbitObject>;
  restore(id: UUID, expectedVersion: number): Promise<OrbitObject>;
  version(id: UUID): Promise<number>;
}

export interface ObjectLifecyclePayload {
  readonly objectId: UUID;
  readonly objectType: ObjectType;
  readonly status: OrbitStatus;
  readonly version: number;
}

export interface ObjectLifecycleEvent extends DomainEvent<ObjectLifecyclePayload> {
  readonly eventType: 'orbit.object.created' | 'orbit.object.updated' | 'orbit.object.deleted' | 'orbit.object.restored';
  readonly aggregateId: UUID;
}

export interface ObjectCreatedEvent extends ObjectLifecycleEvent {
  readonly eventType: 'orbit.object.created';
}

export interface ObjectUpdatedEvent extends ObjectLifecycleEvent {
  readonly eventType: 'orbit.object.updated';
}

export interface ObjectDeletedEvent extends ObjectLifecycleEvent {
  readonly eventType: 'orbit.object.deleted';
}

export interface ObjectRestoredEvent extends ObjectLifecycleEvent {
  readonly eventType: 'orbit.object.restored';
}
