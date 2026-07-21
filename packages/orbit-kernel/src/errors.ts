export class OrbitError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class OrbitValidationError extends OrbitError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message, 'ORBIT_VALIDATION_ERROR', details);
  }
}

export class OrbitNotFoundError extends OrbitError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'ORBIT_NOT_FOUND', { resource, id });
  }
}

export class OrbitConflictError extends OrbitError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message, 'ORBIT_CONFLICT', details);
  }
}

export class OrbitVersionConflictError extends OrbitConflictError {
  constructor(id: string, expectedVersion: number, actualVersion: number) {
    super(`Version conflict for ${id}: expected ${expectedVersion}, received ${actualVersion}`, {
      id,
      expectedVersion,
      actualVersion
    });
  }
}
