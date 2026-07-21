import type {
  CreateOrbitObjectInput,
  OrbitObject,
  OrbitRelationship,
  UpdateOrbitObjectInput,
  UUID,
  Metadata
} from '@tmcc/orbit-kernel';
import type { DomainEvent } from './domain-event.js';

export type MissionState = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface Mission extends OrbitObject {
  readonly missionState: MissionState;
}

export interface MissionCreateInput extends CreateOrbitObjectInput {}

export interface MissionUpdateInput extends Partial<UpdateOrbitObjectInput> {
  readonly expectedVersion: number;
}

export interface MissionRelationshipInput extends Omit<OrbitRelationship, 'id' | 'version' | 'createdAt' | 'updatedAt'> {}

export interface TimelineService {
  getTimeline(missionId: UUID): Promise<unknown[]>;
}

export interface MissionLifecyclePayload {
  readonly missionId: UUID;
  readonly missionState: MissionState;
  readonly version: number;
  readonly metadata: Readonly<Metadata>;
}

export interface MissionLifecycleEvent extends DomainEvent<MissionLifecyclePayload> {
  readonly eventType:
    | 'orbit.mission.created'
    | 'orbit.mission.updated'
    | 'orbit.mission.started'
    | 'orbit.mission.paused'
    | 'orbit.mission.completed'
    | 'orbit.mission.cancelled'
    | 'orbit.mission.object.added'
    | 'orbit.mission.object.removed'
    | 'orbit.mission.relationship.added';
  readonly aggregateId: UUID;
}
