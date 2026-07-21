import { OrbitValidationError, OrbitVersionConflictError } from './errors.js';

export function assertPositiveVersion(version: number): void {
  if (!Number.isInteger(version) || version < 1) {
    throw new OrbitValidationError('Version must be a positive integer', { version });
  }
}

export function assertExpectedVersion(id: string, expectedVersion: number, actualVersion: number): void {
  assertPositiveVersion(expectedVersion);
  assertPositiveVersion(actualVersion);

  if (expectedVersion !== actualVersion) {
    throw new OrbitVersionConflictError(id, expectedVersion, actualVersion);
  }
}

export function nextVersion(currentVersion: number): number {
  assertPositiveVersion(currentVersion);
  return currentVersion + 1;
}
