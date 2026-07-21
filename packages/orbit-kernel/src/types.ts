export type UUID = string & { readonly __brand: 'UUID' };

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type Metadata = Record<string, JsonValue>;

export const ORBIT_OBJECT_TYPES = [
  'evidence',
  'person',
  'organization',
  'location',
  'asset',
  'mission',
  'investigation',
  'story',
  'broadcast',
  'article',
  'media',
  'task',
  'workflow',
  'collection',
  'timeline',
  'custom'
] as const;

export type ObjectType = (typeof ORBIT_OBJECT_TYPES)[number];

export const ORBIT_STATUSES = ['draft', 'active', 'inactive', 'archived', 'deleted'] as const;
export type OrbitStatus = (typeof ORBIT_STATUSES)[number];

export interface OrbitObject {
  readonly id: UUID;
  readonly objectType: ObjectType;
  readonly title: string;
  readonly status: OrbitStatus;
  readonly ownerId?: UUID;
  readonly classification?: string;
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly version: number;
  readonly metadata: Readonly<Metadata>;
  readonly extensions: Readonly<Metadata>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateOrbitObjectInput {
  objectType: ObjectType;
  title: string;
  status?: OrbitStatus;
  ownerId?: UUID;
  classification?: string;
  tags?: readonly string[];
  labels?: Readonly<Record<string, string>>;
  metadata?: Metadata;
  extensions?: Metadata;
}

export interface UpdateOrbitObjectInput {
  title?: string;
  status?: OrbitStatus;
  ownerId?: UUID | null;
  classification?: string | null;
  tags?: readonly string[];
  labels?: Readonly<Record<string, string>>;
  metadata?: Metadata;
  extensions?: Metadata;
  expectedVersion: number;
}

export interface OrbitRelationship {
  readonly id: UUID;
  readonly sourceObjectId: UUID;
  readonly targetObjectId: UUID;
  readonly relationshipType: string;
  readonly metadata: Readonly<Metadata>;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OrbitEvent<TPayload extends Metadata = Metadata> {
  readonly id: UUID;
  readonly eventType: string;
  readonly aggregateId: UUID;
  readonly aggregateType: ObjectType | 'relationship' | 'workflow' | 'mission';
  readonly aggregateVersion: number;
  readonly actorId?: UUID;
  readonly correlationId?: UUID;
  readonly causationId?: UUID;
  readonly payload: Readonly<TPayload>;
  readonly occurredAt: Date;
}
