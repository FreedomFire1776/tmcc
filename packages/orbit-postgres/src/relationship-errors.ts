export class RelationshipNotFoundError extends Error {
  constructor(relationshipId: string) {
    super(`Relationship with id ${relationshipId} was not found.`);
    this.name = 'RelationshipNotFoundError';
  }
}

export class RelationshipVersionConflictError extends Error {
  constructor(relationshipId: string, expectedVersion: number, actualVersion: number) {
    super(`Version conflict for relationship ${relationshipId}: expected ${expectedVersion}, actual ${actualVersion}.`);
    this.name = 'RelationshipVersionConflictError';
  }
}

export class RelationshipAlreadyExistsError extends Error {
  constructor(sourceId: string, targetId: string, relationshipType: string) {
    super(`Relationship already exists between ${sourceId} and ${targetId} of type ${relationshipType}.`);
    this.name = 'RelationshipAlreadyExistsError';
  }
}
