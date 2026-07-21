import type { DomainEvent, DomainEventHandler } from './domain-event.js';

export interface EventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(eventType: string, handler: DomainEventHandler<T>): void;
}

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, DomainEventHandler[]>();

  publish<T extends DomainEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? [];
    return Promise.all(handlers.map((handler) => Promise.resolve(handler(event)))).then(() => undefined);
  }

  subscribe<T extends DomainEvent>(eventType: string, handler: DomainEventHandler<T>): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler as DomainEventHandler);
    this.handlers.set(eventType, existing);
  }
}
