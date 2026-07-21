import { randomUUID } from 'node:crypto';

import { OrbitValidationError } from './errors.js';
import type { UUID } from './types.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createUuid(): UUID {
  return randomUUID() as UUID;
}

export function isUuid(value: unknown): value is UUID {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function asUuid(value: string): UUID {
  if (!isUuid(value)) {
    throw new OrbitValidationError('Invalid UUID', { value });
  }

  return value;
}
