export class WorkflowNotFoundError extends Error {
  constructor(workflowId: string) {
    super(`Workflow with id ${workflowId} was not found.`);
    this.name = 'WorkflowNotFoundError';
  }
}

export class WorkflowStateError extends Error {
  constructor(workflowId: string, attempted: string, validStates: readonly string[]) {
    super(`Cannot ${attempted} workflow ${workflowId} in its current state; valid target states are: ${validStates.join(', ')}.`);
    this.name = 'WorkflowStateError';
  }
}

export class WorkflowVersionConflictError extends Error {
  constructor(workflowId: string, expectedVersion: number, actualVersion: number) {
    super(`Version conflict for workflow ${workflowId}: expected ${expectedVersion}, actual ${actualVersion}.`);
    this.name = 'WorkflowVersionConflictError';
  }
}

export class WorkflowStepNotFoundError extends Error {
  constructor(workflowId: string, stepId: string) {
    super(`Step ${stepId} for workflow ${workflowId} was not found.`);
    this.name = 'WorkflowStepNotFoundError';
  }
}

export class WorkflowStepStateError extends Error {
  constructor(workflowId: string, stepId: string, attempted: string, validStates: readonly string[]) {
    super(`Cannot ${attempted} step ${stepId} for workflow ${workflowId} in its current state; valid step states are: ${validStates.join(', ')}.`);
    this.name = 'WorkflowStepStateError';
  }
}

export class WorkflowStepFailureError extends Error {
  constructor(workflowId: string, stepId: string, reason: string) {
    super(`Workflow ${workflowId} step ${stepId} failed: ${reason}`);
    this.name = 'WorkflowStepFailureError';
  }
}
