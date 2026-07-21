import { Pool } from 'pg';
import type { UnitOfWork } from '@tmcc/orbit-kernel';
import { PostgresUnitOfWork } from './unit-of-work.js';

export interface PostgresOrbitClientConfig {
  connectionString: string;
  maxClients?: number;
}

export class PostgresOrbitClient implements UnitOfWork {
  readonly pool: Pool;

  constructor(config: PostgresOrbitClientConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxClients
    });
  }

  createUnitOfWork(): PostgresUnitOfWork {
    return new PostgresUnitOfWork(this.pool);
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    return this.createUnitOfWork().transaction(operation);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
