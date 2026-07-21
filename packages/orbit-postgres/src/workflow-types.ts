import type { CreateOrbitObjectInput, Metadata, OrbitObject, OrbitRelationship, UUID, UpdateOrbitObjectInput } from '@tmcc/orbit-kernel';
import type { DomainEvent } from './domain-event.js';

export type WorkflowState = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type WorkflowStepState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStepRetryPolicy {
  readonly maxAttempts: number;
  readonly delaySeconds?: number;
}

export interface WorkflowStep {
  readonly id: UUID;
  readonly name: string;
  readonly state: WorkflowStepState;
  readonly order: number;
  readonly metadata: Readonly<Metadata>;
  readonly outputs: Readonly<Metadata>;
  readonly retryCount: number;
  readonly retryPolicy?: WorkflowStepRetryPolicy;
  readonly lastError?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Workflow extends OrbitObject {
  readonly workflowState: WorkflowState;
  readonly steps: readonly WorkflowStep[];
}

export interface WorkflowCreateStepInput {
  readonly name: string;
  readonly metadata?: Metadata;
  readonly retryPolicy?: WorkflowStepRetryPolicy;
}

export interface WorkflowCreateInput extends CreateOrbitObjectInput {
  readonly missionId?: UUID;
  readonly steps: readonly WorkflowCreateStepInput[];
}

export interface WorkflowUpdateInput extends Omit<UpdateOrbitObjectInput, 'status'> {
  readonly expectedVersion: number;
}

export interface WorkflowStatus {
  readonly workflowState: WorkflowState;
  readonly steps: readonly WorkflowStep[];
}

export interface WorkflowExecutor {
  execute(workflowId: UUID, stepId: UUID): Promise<void>;
}

export interface WorkflowLifecyclePayload {
  readonly workflowId: UUID;
  readonly workflowState: WorkflowState;
  readonly version: number;
  readonly metadata: Readonly<Metadata>;
}

export interface WorkflowLifecycleEvent extends DomainEvent<WorkflowLifecyclePayload> {
  readonly eventType:
    | 'orbit.workflow.created'
    | 'orbit.workflow.started'
    | 'orbit.workflow.paused'
    | 'orbit.workflow.resumed'
    | 'orbit.workflow.cancelled'
    | 'orbit.workflow.completed'
    | 'orbit.workflow.failed'
    | 'orbit.workflow.step.executed'
    | 'orbit.workflow.step.retried'
    | 'orbit.workflow.step.skipped';
  readonly aggregateId: UUID;
}
