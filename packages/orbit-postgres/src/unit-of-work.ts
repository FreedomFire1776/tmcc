import type { Pool, PoolClient } from 'pg';
import type { UnitOfWork } from '@tmcc/orbit-kernel';
import { PostgresOrbitObjectRepository } from './object-repository.js';
import { PostgresOrbitEventRepository } from './event-repository.js';
import { PostgresOrbitRelationshipRepository } from './relationship-repository.js';

export class PostgresUnitOfWork implements UnitOfWork {
  private client: PoolClient | null = null;

  constructor(private readonly pool: Pool) {}

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

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    this.client = client;

    try {
      await client.query('BEGIN');
      const result = await operation();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      this.client = null;
      client.release();
    }
  }
}
