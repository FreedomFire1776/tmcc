import { OrbitValidationError } from './errors.js';
import { ORBIT_OBJECT_TYPES, ORBIT_STATUSES } from './types.js';
import type { CreateOrbitObjectInput, ObjectType, OrbitStatus, UpdateOrbitObjectInput } from './types.js';
import { isUuid } from './uuid.js';

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface Validator<T> {
  validate(value: unknown): ValidationResult;
  parse(value: unknown): T;
}

function isObjectType(value: unknown): value is ObjectType {
  return typeof value === 'string' && (ORBIT_OBJECT_TYPES as readonly string[]).includes(value);
}

function isOrbitStatus(value: unknown): value is OrbitStatus {
  return typeof value === 'string' && (ORBIT_STATUSES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseWith<T>(value: unknown, validate: (value: unknown) => ValidationResult): T {
  const result = validate(value);
  if (!result.valid) {
    throw new OrbitValidationError('ORBIT input validation failed', { issues: result.issues });
  }

  return value as T;
}

export const createOrbitObjectValidator: Validator<CreateOrbitObjectInput> = {
  validate(value: unknown): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (!isRecord(value)) {
      return { valid: false, issues: [{ path: '$', message: 'Expected an object' }] };
    }

    if (!isObjectType(value.objectType)) issues.push({ path: 'objectType', message: 'Unsupported object type' });
    if (typeof value.title !== 'string' || value.title.trim().length === 0) issues.push({ path: 'title', message: 'Title is required' });
    if (typeof value.title === 'string' && value.title.length > 240) issues.push({ path: 'title', message: 'Title must not exceed 240 characters' });
    if (value.status !== undefined && !isOrbitStatus(value.status)) issues.push({ path: 'status', message: 'Unsupported status' });
    if (value.ownerId !== undefined && !isUuid(value.ownerId)) issues.push({ path: 'ownerId', message: 'Owner ID must be a UUID' });
    if (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== 'string'))) issues.push({ path: 'tags', message: 'Tags must be strings' });
    if (value.labels !== undefined && (!isRecord(value.labels) || Object.values(value.labels).some((label) => typeof label !== 'string'))) issues.push({ path: 'labels', message: 'Labels must be string values' });
    if (value.metadata !== undefined && !isRecord(value.metadata)) issues.push({ path: 'metadata', message: 'Metadata must be an object' });
    if (value.extensions !== undefined && !isRecord(value.extensions)) issues.push({ path: 'extensions', message: 'Extensions must be an object' });

    return { valid: issues.length === 0, issues };
  },
  parse(value: unknown): CreateOrbitObjectInput {
    return parseWith<CreateOrbitObjectInput>(value, this.validate);
  }
};

export const updateOrbitObjectValidator: Validator<UpdateOrbitObjectInput> = {
  validate(value: unknown): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (!isRecord(value)) {
      return { valid: false, issues: [{ path: '$', message: 'Expected an object' }] };
    }

    if (!Number.isInteger(value.expectedVersion) || Number(value.expectedVersion) < 1) issues.push({ path: 'expectedVersion', message: 'Expected version must be a positive integer' });
    if (value.title !== undefined && (typeof value.title !== 'string' || value.title.trim().length === 0 || value.title.length > 240)) issues.push({ path: 'title', message: 'Title must contain 1-240 characters' });
    if (value.status !== undefined && !isOrbitStatus(value.status)) issues.push({ path: 'status', message: 'Unsupported status' });
    if (value.ownerId !== undefined && value.ownerId !== null && !isUuid(value.ownerId)) issues.push({ path: 'ownerId', message: 'Owner ID must be a UUID or null' });

    return { valid: issues.length === 0, issues };
  },
  parse(value: unknown): UpdateOrbitObjectInput {
    return parseWith<UpdateOrbitObjectInput>(value, this.validate);
  }
};
