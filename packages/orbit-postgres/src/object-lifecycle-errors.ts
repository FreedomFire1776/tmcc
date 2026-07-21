export class ObjectNotFoundError extends Error {
  constructor(objectId: string) {
    super(`Object with id ${objectId} was not found.`);
    this.name = 'ObjectNotFoundError';
  }
}

export class VersionConflictError extends Error {
  constructor(objectId: string, expectedVersion: number, actualVersion: number) {
    super(`Version conflict for object ${objectId}: expected ${expectedVersion}, actual ${actualVersion}.`);
    this.name = 'VersionConflictError';
  }
}
