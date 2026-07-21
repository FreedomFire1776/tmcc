import type { PoolClient } from 'pg';
import type { EventQuery, OrbitEvent, OrbitEventRepository } from '@tmcc/orbit-kernel';

type PostgresClient = PoolClient;

function mapOrbitEventRow(row: any): OrbitEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    aggregateId: row.aggregate_id,
    aggregateType: row.aggregate_type,
    aggregateVersion: row.aggregate_version,
    actorId: row.actor_id ?? undefined,
    correlationId: row.correlation_id ?? undefined,
    causationId: row.causation_id ?? undefined,
    payload: row.payload ?? {},
    occurredAt: row.occurred_at
  };
}

export class PostgresOrbitEventRepository implements OrbitEventRepository {
  constructor(private readonly client: PostgresClient) {}

  async append(event: OrbitEvent): Promise<void> {
    await this.client.query(
      `INSERT INTO orbit_events (
          id,
          event_type,
          aggregate_id,
          aggregate_type,
          aggregate_version,
          actor_id,
          correlation_id,
          causation_id,
          payload,
          occurred_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        event.id,
        event.eventType,
        event.aggregateId,
        event.aggregateType,
        event.aggregateVersion,
        event.actorId ?? null,
        event.correlationId ?? null,
        event.causationId ?? null,
        event.payload ?? {},
        event.occurredAt
      ]
    );
  }

  async findMany(query?: EventQuery) {
    const filters: string[] = [];
    const values: any[] = [];

    if (query?.aggregateId) {
      values.push(query.aggregateId);
      filters.push(`aggregate_id = $${values.length}`);
    }

    if (query?.eventType) {
      values.push(query.eventType);
      filters.push(`event_type = $${values.length}`);
    }

    if (query?.correlationId) {
      values.push(query.correlationId);
      filters.push(`correlation_id = $${values.length}`);
    }

    let sql = 'SELECT * FROM orbit_events';
    if (filters.length > 0) {
      sql += ` WHERE ${filters.join(' AND ')}`;
    }

    sql += ' ORDER BY occurred_at DESC, id DESC';

    if (query?.limit) {
      values.push(query.limit);
      sql += ` LIMIT $${values.length}`;
    }

    const result = await this.client.query(sql, values);
    return {
      items: result.rows.map(mapOrbitEventRow)
    };
  }
}
