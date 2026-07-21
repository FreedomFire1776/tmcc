export class MissionNotFoundError extends Error {
  constructor(missionId: string) {
    super(`Mission with id ${missionId} was not found.`);
    this.name = 'MissionNotFoundError';
  }
}

export class MissionStateError extends Error {
  constructor(missionId: string, attempted: string, validStates: readonly string[]) {
    super(`Cannot ${attempted} mission ${missionId} in its current state; valid target states are: ${validStates.join(', ')}.`);
    this.name = 'MissionStateError';
  }
}

export class MissionRelationshipNotFoundError extends Error {
  constructor(missionId: string, objectId: string) {
    super(`Relationship between mission ${missionId} and object ${objectId} was not found.`);
    this.name = 'MissionRelationshipNotFoundError';
  }
}

export class MissionVersionConflictError extends Error {
  constructor(missionId: string, expectedVersion: number, actualVersion: number) {
    super(`Version conflict for mission ${missionId}: expected ${expectedVersion}, actual ${actualVersion}.`);
    this.name = 'MissionVersionConflictError';
  }
}
