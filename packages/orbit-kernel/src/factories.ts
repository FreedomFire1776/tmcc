import type { CreateOrbitObjectInput, Metadata, OrbitEvent, OrbitObject, UUID } from './types.js';
import { createUuid } from './uuid.js';
import { createOrbitObjectValidator } from './validation.js';

export interface CreateObjectOptions {
  readonly id?: UUID;
  readonly now?: Date;
}

export function createOrbitObject(input: CreateOrbitObjectInput, options: CreateObjectOptions = {}): OrbitObject {
  const validInput = createOrbitObjectValidator.parse(input);
  const now = options.now ?? new Date();

  return Object.freeze({
    id: options.id ?? createUuid(),
    objectType: validInput.objectType,
    title: validInput.title.trim(),
    status: validInput.status ?? 'draft',
    ...(validInput.ownerId ? { ownerId: validInput.ownerId } : {}),
    ...(validInput.classification ? { classification: validInput.classification } : {}),
    tags: Object.freeze([...(validInput.tags ?? [])]),
    labels: Object.freeze({ ...(validInput.labels ?? {}) }),
    version: 1,
    metadata: Object.freeze({ ...(validInput.metadata ?? {}) }),
    extensions: Object.freeze({ ...(validInput.extensions ?? {}) }),
    createdAt: now,
    updatedAt: now
  });
}

export interface CreateEventInput<TPayload extends Metadata> {
  readonly eventType: string;
  readonly aggregateId: UUID;
  readonly aggregateType: OrbitEvent['aggregateType'];
  readonly aggregateVersion: number;
  readonly payload: TPayload;
  readonly actorId?: UUID;
  readonly correlationId?: UUID;
  readonly causationId?: UUID;
}

export function createOrbitEvent<TPayload extends Metadata>(
  input: CreateEventInput<TPayload>,
  options: { readonly id?: UUID; readonly now?: Date } = {}
): OrbitEvent<TPayload> {
  if (!input.eventType.trim()) throw new Error('eventType is required');

  return Object.freeze({
    id: options.id ?? createUuid(),
    eventType: input.eventType.trim(),
    aggregateId: input.aggregateId,
    aggregateType: input.aggregateType,
    aggregateVersion: input.aggregateVersion,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.causationId ? { causationId: input.causationId } : {}),
    payload: Object.freeze({ ...input.payload }),
    occurredAt: options.now ?? new Date()
  });
}
