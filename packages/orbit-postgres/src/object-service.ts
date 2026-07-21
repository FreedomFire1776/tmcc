import { PostgresUnitOfWork } from './unit-of-work.js';
import { PostgresOrbitObjectRepository } from './object-repository.js';
import { EventPublisher } from './event-publisher.js';
import type { OrbitObject, CreateOrbitObjectInput, UpdateOrbitObjectInput, UUID } from '@tmcc/orbit-kernel';
import type { ObjectLifecycle, ObjectLifecyclePayload, ObjectLifecycleEvent } from './object-lifecycle.js';
import { ObjectNotFoundError, VersionConflictError } from './object-lifecycle-errors.js';
import type { DomainEvent } from './domain-event.js';

export class ObjectService implements ObjectLifecycle {
  readonly #repository: PostgresOrbitObjectRepository;
  readonly #unitOfWork: PostgresUnitOfWork;

  constructor(unitOfWork: PostgresUnitOfWork, publisher: EventPublisher) {
    this.#unitOfWork = unitOfWork;
    this.#repository = this.#unitOfWork.objectRepository;
  }

  async create(input: CreateOrbitObjectInput): Promise<OrbitObject> {
    const created = await this.#repository.create(input);
    const event = this.#buildEvent(created, 'orbit.object.created');
    this.#unitOfWork.enqueueEvent(event);
    return created;
  }

  async update(id: UUID, input: UpdateOrbitObjectInput): Promise<OrbitObject> {
    const current = await this.#repository.findById(id);
    if (!current) {
      throw new ObjectNotFoundError(id);
    }
    if (input.expectedVersion !== current.version) {
      throw new VersionConflictError(id, input.expectedVersion, current.version);
    }

    const updated = await this.#repository.update(id, input);
    const event = this.#buildEvent(updated, 'orbit.object.updated');
    this.#unitOfWork.enqueueEvent(event);
    return updated;
  }

  async delete(id: UUID, expectedVersion: number): Promise<OrbitObject> {
    const current = await this.#repository.findById(id);
    if (!current) {
      throw new ObjectNotFoundError(id);
    }
    if (current.version !== expectedVersion) {
      throw new VersionConflictError(id, expectedVersion, current.version);
    }
    if (current.status === 'deleted') {
      return current;
    }

    const deleted = await this.#repository.update(id, { status: 'deleted', expectedVersion });
    const event = this.#buildEvent(deleted, 'orbit.object.deleted');
    this.#unitOfWork.enqueueEvent(event);
    return deleted;
  }

  async restore(id: UUID, expectedVersion: number): Promise<OrbitObject> {
    const current = await this.#repository.findById(id);
    if (!current) {
      throw new ObjectNotFoundError(id);
    }
    if (current.version !== expectedVersion) {
      throw new VersionConflictError(id, expectedVersion, current.version);
    }
    if (current.status !== 'deleted') {
      return current;
    }

    const restored = await this.#repository.update(id, { status: 'active', expectedVersion });
    const event = this.#buildEvent(restored, 'orbit.object.restored');
    this.#unitOfWork.enqueueEvent(event);
    return restored;
  }

  async version(id: UUID): Promise<number> {
    const current = await this.#repository.findById(id);
    if (!current) {
      throw new ObjectNotFoundError(id);
    }
    return current.version;
  }

  #buildEvent(object: OrbitObject, eventType: ObjectLifecycleEvent['eventType']): DomainEvent<ObjectLifecyclePayload> {
    return {
      eventType,
      aggregateId: object.id,
      occurredAt: new Date(),
      payload: {
        objectId: object.id,
        objectType: object.objectType,
        status: object.status,
        version: object.version
      }
    };
  }
}
