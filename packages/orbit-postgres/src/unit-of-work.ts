import type { Pool, PoolClient } from 'pg';
import type { UnitOfWork } from '@tmcc/orbit-kernel';
import { PostgresOrbitObjectRepository } from './object-repository.js';
import { PostgresOrbitEventRepository } from './event-repository.js';
import { PostgresOrbitRelationshipRepository } from './relationship-repository.js';
import type { DomainEvent } from './domain-event.js';
import { EventPublisher } from './event-publisher.js';
import { EventBus, InMemoryEventBus } from './event-bus.js';

export class PostgresUnitOfWork implements UnitOfWork {
  private client: PoolClient | null = null;
  private inTransaction = false;
  private pendingEvents: DomainEvent[] = [];
  private readonly eventPublisher: EventPublisher;

  constructor(private readonly pool: Pool, eventBus: EventBus = new InMemoryEventBus()) {
    this.eventPublisher = new EventPublisher(eventBus);
  }

  get objectRepository() {
    return new PostgresOrbitObjectRepository(this.getClient());
  }

  get eventRepository() {
    return new PostgresOrbitEventRepository(this.getClient());
  }

  get relationshipRepository() {
    return new PostgresOrbitRelationshipRepository(this.getClient());
  }

  private getClient(): PoolClient {
    if (!this.client) {
      throw new Error('Repository access requires an active transaction');
    }
    return this.client;
  }

  async begin(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }

    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    const client = this.getClient();
    if (!this.inTransaction) {
      throw new Error('No active transaction to commit');
    }

    try {
      await client.query('COMMIT');
      const events = [...this.pendingEvents];
      this.clearPendingEvents();
      await Promise.all(events.map((event) => this.eventPublisher.publish(event)));
    } finally {
      await this.dispose();
    }
  }

  async rollback(): Promise<void> {
    const client = this.getClient();
    if (!this.inTransaction) {
      throw new Error('No active transaction to rollback');
    }

    try {
      await client.query('ROLLBACK').catch(() => {});
    } finally {
      this.clearPendingEvents();
      await this.dispose();
    }
  }

  async dispose(): Promise<void> {
    this.clearPendingEvents();

    if (this.client) {
      this.client.release();
      this.client = null;
    }

    this.inTransaction = false;
  }

  enqueueEvent(event: DomainEvent): void {
    if (!this.inTransaction) {
      throw new Error('Cannot enqueue domain events outside of a transaction');
    }
    this.pendingEvents.push(event);
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    await this.begin();

    try {
      const result = await operation();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback().catch(() => {});
      throw error;
    }
  }

  private clearPendingEvents(): void {
    this.pendingEvents.length = 0;
  }
}
