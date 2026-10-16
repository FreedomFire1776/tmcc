import type { PoolClient } from 'pg';
import type {
  OrbitRelationship,
  OrbitObject,
  RelationshipQuery,
  UUID,
  Metadata,
  Page
} from '@tmcc/orbit-kernel';
import { PostgresUnitOfWork } from './unit-of-work.js';
import { PostgresOrbitRelationshipRepository } from './relationship-repository.js';
import type { QueryService, RelatedObjectQuery } from './query-service.js';
import type { SearchService } from './search-service.js';
import type { ObjectService } from './object-service.js';
import { RelationshipNotFoundError, RelationshipVersionConflictError, RelationshipAlreadyExistsError } from './relationship-errors.js';
import type { RelationshipModel, RelationshipLifecyclePayload, RelationshipLifecycleEvent } from './relationship-types.js';
import type { DomainEvent } from './domain-event.js';

export interface RelationshipService {
  createRelationship(input: Omit<OrbitRelationship, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<RelationshipModel>;
  removeRelationship(id: UUID, expectedVersion: number): Promise<RelationshipModel>;
  updateRelationship(id: UUID, input: Partial<Omit<OrbitRelationship, 'id' | 'sourceObjectId' | 'targetObjectId' | 'createdAt' | 'updatedAt'>> & { expectedVersion: number }): Promise<RelationshipModel>;
  getRelationships(query?: RelationshipQuery): Promise<Page<RelationshipModel>>;
  getRelatedObjects(query: RelatedObjectQuery): Promise<Page<OrbitObject>>;
  relationshipExists(sourceObjectId: UUID, targetObjectId: UUID, relationshipType: string): Promise<boolean>;
}

export class PostgresRelationshipService implements RelationshipService {
  readonly #repository: PostgresOrbitRelationshipRepository;
  readonly #queryService: QueryService;
  readonly #unitOfWork: PostgresUnitOfWork;
  readonly #objectService: ObjectService;

  // Keep the search-service argument for compatibility with existing service constructors.
  constructor(unitOfWork: PostgresUnitOfWork, queryService: QueryService, _searchService: SearchService, objectService: ObjectService) {
    this.#unitOfWork = unitOfWork;
    this.#repository = this.#unitOfWork.relationshipRepository;
    this.#queryService = queryService;
    this.#objectService = objectService;
  }

  async createRelationship(input: Omit<OrbitRelationship, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<RelationshipModel> {
    await this.#objectService.version(input.sourceObjectId);
    await this.#objectService.version(input.targetObjectId);

    const existing = await this.findExistingRelationship(input.sourceObjectId, input.targetObjectId, input.relationshipType);
    if (existing) {
      throw new RelationshipAlreadyExistsError(input.sourceObjectId, input.targetObjectId, input.relationshipType);
    }

    const created = await this.#repository.create({
      ...input,
      id: crypto.randomUUID() as UUID,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const event = this.#buildEvent(created, 'orbit.relationship.created');
    this.#unitOfWork.enqueueEvent(event);
    return this.#mapToModel(created);
  }

  async removeRelationship(id: UUID, expectedVersion: number): Promise<RelationshipModel> {
    const current = await this.#repository.findById(id);
    if (!current) {
      throw new RelationshipNotFoundError(id);
    }
    if (current.version !== expectedVersion) {
      throw new RelationshipVersionConflictError(id, expectedVersion, current.version);
    }

    const removed = await this.#repository.delete(id, expectedVersion);
    const event = this.#buildEvent(removed, 'orbit.relationship.removed');
    this.#unitOfWork.enqueueEvent(event);
    return this.#mapToModel(removed);
  }

  async updateRelationship(id: UUID, input: Partial<Omit<OrbitRelationship, 'id' | 'sourceObjectId' | 'targetObjectId' | 'createdAt' | 'updatedAt'>> & { expectedVersion: number }): Promise<RelationshipModel> {
    const current = await this.#repository.findById(id);
    if (!current) {
      throw new RelationshipNotFoundError(id);
    }
    if (current.version !== input.expectedVersion) {
      throw new RelationshipVersionConflictError(id, input.expectedVersion, current.version);
    }

    const updatePayload: {
      relationshipType?: string;
      metadata?: Metadata;
      expectedVersion: number;
    } = {
      expectedVersion: input.expectedVersion
    };

    if (input.relationshipType !== undefined) {
      updatePayload.relationshipType = input.relationshipType;
    }
    if (input.metadata !== undefined) {
      updatePayload.metadata = input.metadata;
    }

    const updated = await this.#repository.update(id, updatePayload);

    const event = this.#buildEvent(updated, 'orbit.relationship.updated');
    this.#unitOfWork.enqueueEvent(event);
    return this.#mapToModel(updated);
  }

  async getRelationships(query?: RelationshipQuery): Promise<Page<RelationshipModel>> {
    const relationships = await this.#repository.findMany(query);
    return {
      items: relationships.items.map((relationship) => this.#mapToModel(relationship)),
      ...(relationships.nextCursor ? { nextCursor: relationships.nextCursor } : {})
    };
  }

  async getRelatedObjects(query: RelatedObjectQuery): Promise<Page<OrbitObject>> {
    return this.#queryService.findByRelationship(query);
  }

  async relationshipExists(sourceObjectId: UUID, targetObjectId: UUID, relationshipType: string): Promise<boolean> {
    const result = await this.findExistingRelationship(sourceObjectId, targetObjectId, relationshipType);
    return result !== null;
  }

  async findExistingRelationship(sourceObjectId: UUID, targetObjectId: UUID, relationshipType: string): Promise<OrbitRelationship | null> {
    const relationships = await this.#repository.findMany({ sourceObjectId, targetObjectId, relationshipType, limit: 1 });
    const [relationship] = relationships.items;
    return relationship ?? null;
  }

  #buildEvent(relationship: OrbitRelationship, eventType: RelationshipLifecycleEvent['eventType']): DomainEvent<RelationshipLifecyclePayload> {
    return {
      eventType,
      aggregateId: relationship.id,
      occurredAt: new Date(),
      payload: {
        relationshipId: relationship.id,
        sourceObjectId: relationship.sourceObjectId,
        targetObjectId: relationship.targetObjectId,
        relationshipType: relationship.relationshipType,
        metadata: relationship.metadata,
        version: relationship.version
      }
    };
  }

  #mapToModel(relationship: OrbitRelationship): RelationshipModel {
    return {
      ...relationship,
      direction: relationship.sourceObjectId === relationship.targetObjectId ? 'undirected' : 'forward'
    };
  }
}
