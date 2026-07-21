import type {
  OrbitObject,
  UUID,
  Metadata,
  JsonValue
} from '@tmcc/orbit-kernel';
import { PostgresOrbitObjectRepository } from './object-repository.js';
import { PostgresUnitOfWork } from './unit-of-work.js';
import type { ObjectService } from './object-service.js';
import type { RelationshipService } from './relationship-service.js';
import type { QueryService } from './query-service.js';
import { EventPublisher } from './event-publisher.js';
import {
  WorkflowNotFoundError,
  WorkflowStateError,
  WorkflowVersionConflictError,
  WorkflowStepNotFoundError,
  WorkflowStepStateError,
  WorkflowStepFailureError
} from './workflow-errors.js';
import type {
  Workflow,
  WorkflowCreateInput,
  WorkflowCreateStepInput,
  WorkflowCreateStepInput as StepInput,
  WorkflowState,
  WorkflowStepState,
  WorkflowStep,
  WorkflowStatus,
  WorkflowExecutor,
  WorkflowLifecyclePayload,
  WorkflowLifecycleEvent
} from './workflow-types.js';
import type { DomainEvent } from './domain-event.js';

const WORKFLOW_STATE_TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  draft: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled', 'failed'],
  paused: ['active', 'cancelled', 'failed'],
  completed: [],
  cancelled: [],
  failed: []
};

const STEP_STATE_TRANSITIONS: Record<WorkflowStepState, readonly WorkflowStepState[]> = {
  pending: ['running', 'skipped'],
  running: ['completed', 'failed', 'skipped'],
  completed: [],
  failed: ['running', 'skipped'],
  skipped: []
};

function requireState<T extends string>(value: T | undefined, field: string): T {
  if (value === undefined) {
    throw new Error(`${field} is required`);
  }
  return value;
}

export interface WorkflowService {
  createWorkflow(input: WorkflowCreateInput): Promise<Workflow>;
  getWorkflow(id: UUID): Promise<Workflow>;
  startWorkflow(id: UUID, expectedVersion: number): Promise<Workflow>;
  pauseWorkflow(id: UUID, expectedVersion: number): Promise<Workflow>;
  resumeWorkflow(id: UUID, expectedVersion: number): Promise<Workflow>;
  cancelWorkflow(id: UUID, expectedVersion: number): Promise<Workflow>;
  completeWorkflow(id: UUID, expectedVersion: number): Promise<Workflow>;
  executeStep(workflowId: UUID, stepId: UUID, expectedVersion: number): Promise<Workflow>;
  retryStep(workflowId: UUID, stepId: UUID, expectedVersion: number): Promise<Workflow>;
  skipStep(workflowId: UUID, stepId: UUID, expectedVersion: number): Promise<Workflow>;
  getWorkflowStatus(workflowId: UUID): Promise<WorkflowStatus>;
}

export class PostgresWorkflowService implements WorkflowService {
  readonly #unitOfWork: PostgresUnitOfWork;
  readonly #objectService: ObjectService;
  readonly #relationshipService: RelationshipService;
  readonly #queryService: QueryService;
  readonly #publisher: EventPublisher;
  readonly #executor: WorkflowExecutor | undefined;
  readonly #repository: PostgresOrbitObjectRepository;

  constructor(
    unitOfWork: PostgresUnitOfWork,
    objectService: ObjectService,
    relationshipService: RelationshipService,
    queryService: QueryService,
    publisher: EventPublisher,
    executor?: WorkflowExecutor
  ) {
    this.#unitOfWork = unitOfWork;
    this.#objectService = objectService;
    this.#relationshipService = relationshipService;
    this.#queryService = queryService;
    this.#publisher = publisher;
    this.#executor = executor;
    this.#repository = this.#unitOfWork.objectRepository as PostgresOrbitObjectRepository;
  }

  async createWorkflow(input: WorkflowCreateInput): Promise<Workflow> {
    return this.#unitOfWork.transaction(async () => {
      const steps = this.#buildSteps(input.steps);
      const workflow = await this.#repository.create({
        ...input,
        objectType: 'workflow',
        metadata: {
          ...(input.metadata ?? {}),
          workflowState: 'draft',
          steps: this.#serializeSteps(steps)
        }
      });

      const result = this.#hydrateWorkflow(workflow);
      this.#unitOfWork.enqueueEvent(this.#buildEvent(result, 'orbit.workflow.created'));
      return result;
    });
  }

  async getWorkflow(id: UUID): Promise<Workflow> {
    const workflow = await this.#repository.findById(id);
    if (!workflow) {
      throw new WorkflowNotFoundError(id);
    }
    return this.#hydrateWorkflow(workflow);
  }

  async startWorkflow(id: UUID, expectedVersion: number): Promise<Workflow> {
    return this.#changeState(id, expectedVersion, 'active', 'orbit.workflow.started');
  }

  async pauseWorkflow(id: UUID, expectedVersion: number): Promise<Workflow> {
    return this.#changeState(id, expectedVersion, 'paused', 'orbit.workflow.paused');
  }

  async resumeWorkflow(id: UUID, expectedVersion: number): Promise<Workflow> {
    return this.#changeState(id, expectedVersion, 'active', 'orbit.workflow.resumed');
  }

  async cancelWorkflow(id: UUID, expectedVersion: number): Promise<Workflow> {
    return this.#changeState(id, expectedVersion, 'cancelled', 'orbit.workflow.cancelled');
  }

  async completeWorkflow(id: UUID, expectedVersion: number): Promise<Workflow> {
    return this.#changeState(id, expectedVersion, 'completed', 'orbit.workflow.completed');
  }

  async executeStep(workflowId: UUID, stepId: UUID, expectedVersion: number): Promise<Workflow> {
    return this.#transitionStep(workflowId, stepId, expectedVersion, 'running', 'orbit.workflow.step.executed');
  }

  async retryStep(workflowId: UUID, stepId: UUID, expectedVersion: number): Promise<Workflow> {
    return this.#transitionStep(workflowId, stepId, expectedVersion, 'running', 'orbit.workflow.step.retried');
  }

  async skipStep(workflowId: UUID, stepId: UUID, expectedVersion: number): Promise<Workflow> {
    return this.#transitionStep(workflowId, stepId, expectedVersion, 'skipped', 'orbit.workflow.step.skipped');
  }

  async getWorkflowStatus(workflowId: UUID): Promise<WorkflowStatus> {
    const workflow = await this.getWorkflow(workflowId);
    return {
      workflowState: workflow.workflowState,
      steps: workflow.steps
    };
  }

  async #changeState(id: UUID, expectedVersion: number, targetState: WorkflowState, eventType: WorkflowLifecycleEvent['eventType']): Promise<Workflow> {
    return this.#unitOfWork.transaction(async () => {
      const current = await this.getWorkflow(id);
      if (current.version !== expectedVersion) {
        throw new WorkflowVersionConflictError(id, expectedVersion, current.version);
      }

      if (!WORKFLOW_STATE_TRANSITIONS[current.workflowState].includes(targetState)) {
        throw new WorkflowStateError(id, eventType, WORKFLOW_STATE_TRANSITIONS[current.workflowState]);
      }

      const updated = await this.#repository.update(id, {
        metadata: {
          ...current.metadata,
          workflowState: targetState,
          steps: this.#serializeSteps(current.steps)
        },
        expectedVersion
      });

      const workflow = this.#hydrateWorkflow(updated);
      this.#unitOfWork.enqueueEvent(this.#buildEvent(workflow, eventType));
      return workflow;
    });
  }

  async #transitionStep(
    workflowId: UUID,
    stepId: UUID,
    expectedVersion: number,
    targetStepState: WorkflowStepState,
    eventType: WorkflowLifecycleEvent['eventType']
  ): Promise<Workflow> {
    return this.#unitOfWork.transaction(async () => {
      const workflow = await this.getWorkflow(workflowId);
      if (workflow.version !== expectedVersion) {
        throw new WorkflowVersionConflictError(workflowId, expectedVersion, workflow.version);
      }

      const stepIndex = workflow.steps.findIndex((step) => step.id === stepId);
      if (stepIndex === -1) {
        throw new WorkflowStepNotFoundError(workflowId, stepId);
      }

      const step = workflow.steps[stepIndex];
      if (!step) {
        throw new WorkflowStepNotFoundError(workflowId, stepId);
      }

      if (!STEP_STATE_TRANSITIONS[step.state].includes(targetStepState)) {
        throw new WorkflowStepStateError(workflowId, stepId, targetStepState, STEP_STATE_TRANSITIONS[step.state]);
      }

      const retryCount = targetStepState === 'running' && step.state === 'failed' ? step.retryCount + 1 : step.retryCount;
      const updatedStep: WorkflowStep = {
        id: step.id,
        name: step.name,
        state: targetStepState,
        order: step.order,
        metadata: step.metadata,
        outputs: step.outputs,
        retryCount,
        ...(step.retryPolicy ? { retryPolicy: step.retryPolicy } : {}),
        createdAt: step.createdAt,
        updatedAt: new Date().toISOString(),
        ...(targetStepState === 'failed'
          ? { lastError: step.lastError ?? 'Execution failed' }
          : step.lastError
          ? { lastError: step.lastError }
          : {})
      };

      const updatedSteps = [...workflow.steps];
      updatedSteps[stepIndex] = updatedStep;

      const updated = await this.#repository.update(workflowId, {
        metadata: {
          ...workflow.metadata,
          workflowState: workflow.workflowState,
          steps: this.#serializeSteps(updatedSteps)
        },
        expectedVersion
      });

      const updatedWorkflow = this.#hydrateWorkflow(updated);
      this.#unitOfWork.enqueueEvent(this.#buildEvent(updatedWorkflow, eventType));

      if (targetStepState === 'running' && this.#executor) {
        await this.#executor.execute(workflowId, stepId);
      }

      if (targetStepState === 'failed') {
        throw new WorkflowStepFailureError(workflowId, stepId, 'Step execution failed after transition');
      }

      return updatedWorkflow;
    });
  }

  #buildSteps(inputs: readonly WorkflowCreateStepInput[]): WorkflowStep[] {
    return inputs.map((step, index) => ({
      id: crypto.randomUUID() as UUID,
      name: step.name,
      state: 'pending',
      order: index + 1,
      metadata: step.metadata ?? {},
      outputs: {},
      retryCount: 0,
      retryPolicy: step.retryPolicy ?? { maxAttempts: 1 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  }

  #serializeSteps(steps: readonly WorkflowStep[]): JsonValue[] {
    return steps.map((step) => {
      const serialized: Record<string, JsonValue> = {
        id: step.id,
        name: step.name,
        state: step.state,
        order: step.order,
        metadata: step.metadata,
        outputs: step.outputs,
        retryCount: step.retryCount,
        createdAt: step.createdAt,
        updatedAt: step.updatedAt
      };

      if (step.retryPolicy) {
        serialized.retryPolicy = {
          maxAttempts: step.retryPolicy.maxAttempts,
          ...(step.retryPolicy.delaySeconds !== undefined ? { delaySeconds: step.retryPolicy.delaySeconds } : {})
        };
      }

      if (step.lastError !== undefined) {
        serialized.lastError = step.lastError;
      }

      return serialized;
    });
  }

  #hydrateWorkflow(workflow: OrbitObject): Workflow {
    const workflowState = (workflow.metadata?.workflowState as WorkflowState | undefined) ?? 'draft';
    const steps = (workflow.metadata?.steps as WorkflowStep[] | undefined) ?? [];
    return {
      ...workflow,
      workflowState,
      steps
    };
  }

  #buildEvent(workflow: Workflow, eventType: WorkflowLifecycleEvent['eventType']): DomainEvent<WorkflowLifecyclePayload> {
    return {
      eventType,
      aggregateId: workflow.id,
      occurredAt: new Date(),
      payload: {
        workflowId: workflow.id,
        workflowState: workflow.workflowState,
        version: workflow.version,
        metadata: workflow.metadata
      }
    };
  }
}
