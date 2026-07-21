export interface DomainEvent<TPayload = unknown> {
  readonly eventType: string;
  readonly aggregateId?: string;
  readonly payload: TPayload;
  readonly occurredAt: Date;
}

export type DomainEventHandler<T extends DomainEvent = DomainEvent> = (
  event: T
) => Promise<void> | void;
