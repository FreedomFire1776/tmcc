import type { PoolClient } from 'pg';
import type {
  OrbitObject,
  OrbitRelationship,
  UUID,
  Page,
  Metadata,
  CreateOrbitObjectInput,
  UpdateOrbitObjectInput,
  RelationshipQuery
} from '@tmcc/orbit-kernel';
import { PostgresOrbitObjectRepository } from './object-repository.js';
import { PostgresOrbitRelationshipRepository } from './relationship-repository.js';
import { PostgresUnitOfWork } from './unit-of-work.js';
import type { QueryService } from './query-service.js';
import type { ObjectService } from './object-service.js';
import type { RelationshipService } from './relationship-service.js';
import { EventPublisher } from './event-publisher.js';
import { MissionNotFoundError, MissionStateError, MissionVersionConflictError, MissionRelationshipNotFoundError } from './mission-errors.js';
import type {
  Mission,
  MissionCreateInput,
  MissionUpdateInput,
  MissionRelationshipInput,
  MissionState,
  TimelineService,
  MissionLifecyclePayload,
  MissionLifecycleEvent
} from './mission-types.js';
import type { DomainEvent } from './domain-event.js';

const MISSION_STATE_TRANSITIONS: Record<MissionState, readonly MissionState[]> = {
  draft: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [],
  cancelled: []
};

export interface MissionService {
  createMission(input: MissionCreateInput): Promise<Mission>;
  getMission(id: UUID): Promise<Mission>;
  updateMission(id: UUID, input: MissionUpdateInput): Promise<Mission>;
  startMission(id: UUID, expectedVersion: number): Promise<Mission>;
  pauseMission(id: UUID, expectedVersion: number): Promise<Mission>;
  completeMission(id: UUID, expectedVersion: number): Promise<Mission>;
  cancelMission(id: UUID, expectedVersion: number): Promise<Mission>;
  addObject(missionId: UUID, objectId: UUID, expectedVersion: number): Promise<Mission>;
  removeObject(missionId: UUID, objectId: UUID, expectedVersion: number): Promise<Mission>;
  addRelationship(missionId: UUID, relationship: MissionRelationshipInput, expectedVersion: number): Promise<Mission>;
  getMissionTimeline(missionId: UUID): Promise<unknown[]>;
}

export class PostgresMissionService implements MissionService {
  readonly #unitOfWork: PostgresUnitOfWork;
  readonly #objectService: ObjectService;
  readonly #relationshipService: RelationshipService;
  readonly #queryService: QueryService;
  readonly #timelineService: TimelineService | undefined;
  readonly #publisher: EventPublisher;
  readonly #repository: PostgresOrbitObjectRepository;
  readonly #relationshipRepository: PostgresOrbitRelationshipRepository;

  constructor(
    unitOfWork: PostgresUnitOfWork,
    objectService: ObjectService,
    relationshipService: RelationshipService,
    queryService: QueryService,
    publisher: EventPublisher,
    timelineService?: TimelineService
  ) {
    this.#unitOfWork = unitOfWork;
    this.#objectService = objectService;
    this.#relationshipService = relationshipService;
    this.#queryService = queryService;
    this.#publisher = publisher;
    this.#timelineService = timelineService;
    this.#repository = this.#unitOfWork.objectRepository as PostgresOrbitObjectRepository;
    this.#relationshipRepository = this.#unitOfWork.relationshipRepository;
  }

  async createMission(input: MissionCreateInput): Promise<Mission> {
    return this.#unitOfWork.transaction(async () => {
      const created = await this.#repository.create({
        ...input,
        objectType: 'mission',
        metadata: {
          ...(input.metadata ?? {}),
          missionState: 'draft'
        }
      });

      const mission = this.#withMissionState(created, 'draft');
      const event = this.#buildEvent(mission, 'orbit.mission.created');
      this.#unitOfWork.enqueueEvent(event);
      return mission;
    });
  }

  async getMission(id: UUID): Promise<Mission> {
    const mission = await this.#repository.findById(id);
    if (!mission) {
      throw new MissionNotFoundError(id);
    }
    const missionState = this.#getMissionState(mission);
    return this.#withMissionState(mission, missionState);
  }

  async updateMission(id: UUID, input: MissionUpdateInput): Promise<Mission> {
    return this.#unitOfWork.transaction(async () => {
      const current = await this.getMission(id);
      if (current.version !== input.expectedVersion) {
        throw new MissionVersionConflictError(id, input.expectedVersion, current.version);
      }

      const updatedMetadata = {
        ...current.metadata,
        ...(input.metadata ?? {}),
        missionState: current.missionState
      };

      const updated = await this.#repository.update(id, {
        ...input,
        metadata: updatedMetadata
      });

      const mission = this.#withMissionState(updated, current.missionState);
      const event = this.#buildEvent(mission, 'orbit.mission.updated');
      this.#unitOfWork.enqueueEvent(event);
      return mission;
    });
  }

  async startMission(id: UUID, expectedVersion: number): Promise<Mission> {
    return this.#changeState(id, expectedVersion, 'active', 'orbit.mission.started');
  }

  async pauseMission(id: UUID, expectedVersion: number): Promise<Mission> {
    return this.#changeState(id, expectedVersion, 'paused', 'orbit.mission.paused');
  }

  async completeMission(id: UUID, expectedVersion: number): Promise<Mission> {
    return this.#changeState(id, expectedVersion, 'completed', 'orbit.mission.completed');
  }

  async cancelMission(id: UUID, expectedVersion: number): Promise<Mission> {
    return this.#changeState(id, expectedVersion, 'cancelled', 'orbit.mission.cancelled');
  }

  async addObject(missionId: UUID, objectId: UUID, expectedVersion: number): Promise<Mission> {
    return this.#unitOfWork.transaction(async () => {
      const current = await this.getMission(missionId);
      if (current.version !== expectedVersion) {
        throw new MissionVersionConflictError(missionId, expectedVersion, current.version);
      }

      await this.#objectService.version(objectId);
      await this.#relationshipService.createRelationship({
        sourceObjectId: missionId,
        targetObjectId: objectId,
        relationshipType: 'mission-object',
        metadata: {}
      });

      const mission = await this.getMission(missionId);
      const event = this.#buildEvent(mission, 'orbit.mission.object.added');
      this.#unitOfWork.enqueueEvent(event);
      return mission;
    });
  }

  async removeObject(missionId: UUID, objectId: UUID, expectedVersion: number): Promise<Mission> {
    return this.#unitOfWork.transaction(async () => {
      const current = await this.getMission(missionId);
      if (current.version !== expectedVersion) {
        throw new MissionVersionConflictError(missionId, expectedVersion, current.version);
      }

      const relationship = await this._findMissionObjectRelationship(missionId, objectId);
      await this.#relationshipService.removeRelationship(relationship.id, expectedVersion);

      const mission = await this.getMission(missionId);
      const event = this.#buildEvent(mission, 'orbit.mission.object.removed');
      this.#unitOfWork.enqueueEvent(event);
      return mission;
    });
  }

  async addRelationship(missionId: UUID, relationship: MissionRelationshipInput, expectedVersion: number): Promise<Mission> {
    return this.#unitOfWork.transaction(async () => {
      const current = await this.getMission(missionId);
      if (current.version !== expectedVersion) {
        throw new MissionVersionConflictError(missionId, expectedVersion, current.version);
      }

      await this.#objectService.version(relationship.sourceObjectId);
      await this.#objectService.version(relationship.targetObjectId);

      await this.#relationshipService.createRelationship(relationship);
      const mission = await this.getMission(missionId);
      const event = this.#buildEvent(mission, 'orbit.mission.relationship.added');
      this.#unitOfWork.enqueueEvent(event);
      return mission;
    });
  }

  async getMissionTimeline(missionId: UUID): Promise<unknown[]> {
    if (!this.#timelineService) {
      throw new Error('TimelineService is not configured');
    }
    await this.getMission(missionId);
    return this.#timelineService.getTimeline(missionId);
  }

  async #changeState(id: UUID, expectedVersion: number, targetState: MissionState, eventType: MissionLifecycleEvent['eventType']): Promise<Mission> {
    return this.#unitOfWork.transaction(async () => {
      const current = await this.getMission(id);
      if (current.version !== expectedVersion) {
        throw new MissionVersionConflictError(id, expectedVersion, current.version);
      }

      if (!MISSION_STATE_TRANSITIONS[current.missionState].includes(targetState)) {
        throw new MissionStateError(id, eventType, MISSION_STATE_TRANSITIONS[current.missionState]);
      }

      const updated = await this.#repository.update(id, {
        metadata: {
          ...current.metadata,
          missionState: targetState
        },
        expectedVersion
      });

      const mission = this.#withMissionState(updated, targetState);
      const event = this.#buildEvent(mission, eventType);
      this.#unitOfWork.enqueueEvent(event);
      return mission;
    });
  }

  async _findMissionObjectRelationship(missionId: UUID, objectId: UUID): Promise<OrbitRelationship> {
    const relationships = await this.#relationshipService.getRelationships({ sourceObjectId: missionId, targetObjectId: objectId, relationshipType: 'mission-object', limit: 1 });
    const relationship = relationships.items[0];
    if (!relationship) {
      throw new MissionRelationshipNotFoundError(missionId, objectId);
    }
    return relationship;
  }

  #withMissionState(object: OrbitObject, missionState: MissionState): Mission {
    return {
      ...object,
      missionState
    };
  }

  #getMissionState(object: OrbitObject): MissionState {
    return (object.metadata?.missionState as MissionState | undefined) ?? 'draft';
  }

  #buildEvent(mission: Mission, eventType: MissionLifecycleEvent['eventType']): DomainEvent<MissionLifecyclePayload> {
    return {
      eventType,
      aggregateId: mission.id,
      occurredAt: new Date(),
      payload: {
        missionId: mission.id,
        missionState: mission.missionState,
        version: mission.version,
        metadata: mission.metadata
      }
    };
  }
}
