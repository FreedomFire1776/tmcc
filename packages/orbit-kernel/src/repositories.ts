import type {
  CreateOrbitObjectInput,
  ObjectType,
  OrbitEvent,
  OrbitObject,
  OrbitRelationship,
  OrbitStatus,
  UUID,
  UpdateOrbitObjectInput
} from './types.js';

export interface PageRequest {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

export interface ObjectQuery extends PageRequest {
  readonly objectType?: ObjectType;
  readonly status?: OrbitStatus;
  readonly ownerId?: UUID;
  readonly tag?: string;
}

export interface OrbitObjectRepository {
  create(input: CreateOrbitObjectInput): Promise<OrbitObject>;
  findById(id: UUID): Promise<OrbitObject | null>;
  findMany(query?: ObjectQuery): Promise<Page<OrbitObject>>;
  update(id: UUID, input: UpdateOrbitObjectInput): Promise<OrbitObject>;
}

export interface EventQuery extends PageRequest {
  readonly aggregateId?: UUID;
  readonly eventType?: string;
  readonly correlationId?: UUID;
}

export interface OrbitEventRepository {
  append(event: OrbitEvent): Promise<void>;
  findMany(query?: EventQuery): Promise<Page<OrbitEvent>>;
}

export interface RelationshipQuery extends PageRequest {
  readonly sourceObjectId?: UUID;
  readonly targetObjectId?: UUID;
  readonly relationshipType?: string;
}

export interface OrbitRelationshipRepository {
  create(relationship: OrbitRelationship): Promise<OrbitRelationship>;
  findById(id: UUID): Promise<OrbitRelationship | null>;
  findMany(query?: RelationshipQuery): Promise<Page<OrbitRelationship>>;
}

export interface UnitOfWork {
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}
