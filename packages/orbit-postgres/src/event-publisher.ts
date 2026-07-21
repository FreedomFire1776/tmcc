import type { DomainEvent } from './domain-event.js';
import type { EventBus } from './event-bus.js';

export class EventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    await this.eventBus.publish(event);
  }
}
