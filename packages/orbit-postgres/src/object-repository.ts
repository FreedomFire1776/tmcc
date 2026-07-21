import type { PoolClient, Pool } from 'pg';
import type {
  CreateOrbitObjectInput,
  ObjectQuery,
  OrbitObject,
  OrbitStatus,
  ObjectType,
  UpdateOrbitObjectInput
} from '@tmcc/orbit-kernel';
import type { OrbitObjectRepository } from '@tmcc/orbit-kernel';
import { OrbitNotFoundError, OrbitVersionConflictError } from '@tmcc/orbit-kernel';

type PostgresClient = Pool | PoolClient;

function mapOrbitObjectRow(row: any): OrbitObject {
  return {
    id: row.id,
    objectType: row.object_type,
    title: row.title,
    status: row.status,
    ownerId: row.owner_id ?? undefined,
    classification: row.classification ?? undefined,
    tags: row.tags ?? [],
    labels: row.labels ?? {},
    version: row.version,
    metadata: row.metadata ?? {},
    extensions: row.extensions ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PostgresOrbitObjectRepository implements OrbitObjectRepository {
  constructor(private readonly client: PostgresClient) {}

  async create(input: CreateOrbitObjectInput): Promise<OrbitObject> {
    const result = await this.client.query(
      `INSERT INTO orbit_objects (
          object_type,
          title,
          status,
          owner_id,
          classification,
          tags,
          labels,
          metadata,
          extensions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
      [
        input.objectType,
        input.title,
        input.status ?? 'draft',
        input.ownerId ?? null,
        input.classification ?? null,
        input.tags ?? [],
        input.labels ?? {},
        input.metadata ?? {},
        input.extensions ?? {}
      ]
    );

    return mapOrbitObjectRow(result.rows[0]);
  }

  async findById(id: string): Promise<OrbitObject | null> {
    const result = await this.client.query('SELECT * FROM orbit_objects WHERE id = $1', [id]);
    return result.rowCount === 0 ? null : mapOrbitObjectRow(result.rows[0]);
  }

  async findMany(query?: ObjectQuery) {
    const filters: string[] = [];
    const values: any[] = [];

    if (query?.objectType) {
      values.push(query.objectType);
      filters.push(`object_type = $${values.length}`);
    }

    if (query?.status) {
      values.push(query.status);
      filters.push(`status = $${values.length}`);
    }

    if (query?.ownerId) {
      values.push(query.ownerId);
      filters.push(`owner_id = $${values.length}`);
    }

    if (query?.tag) {
      values.push(query.tag);
      filters.push(`$${values.length} = ANY(tags)`);
    }

    let sql = 'SELECT * FROM orbit_objects';
    if (filters.length > 0) {
      sql += ` WHERE ${filters.join(' AND ')}`;
    }

    sql += ' ORDER BY created_at DESC, id DESC';

    if (query?.limit) {
      values.push(query.limit);
      sql += ` LIMIT $${values.length}`;
    }

    const result = await this.client.query(sql, values);
    return {
      items: result.rows.map(mapOrbitObjectRow)
    };
  }

  async update(id: string, input: UpdateOrbitObjectInput): Promise<OrbitObject> {
    const sets: string[] = [];
    const values: any[] = [id, input.expectedVersion];

    if (input.title !== undefined) {
      values.push(input.title);
      sets.push(`title = $${values.length}`);
    }

    if (input.status !== undefined) {
      values.push(input.status);
      sets.push(`status = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(input, 'ownerId')) {
      values.push(input.ownerId ?? null);
      sets.push(`owner_id = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(input, 'classification')) {
      values.push(input.classification ?? null);
      sets.push(`classification = $${values.length}`);
    }

    if (input.tags !== undefined) {
      values.push(input.tags);
      sets.push(`tags = $${values.length}`);
    }

    if (input.labels !== undefined) {
      values.push(input.labels);
      sets.push(`labels = $${values.length}`);
    }

    if (input.metadata !== undefined) {
      values.push(input.metadata);
      sets.push(`metadata = $${values.length}`);
    }

    if (input.extensions !== undefined) {
      values.push(input.extensions);
      sets.push(`extensions = $${values.length}`);
    }

    if (sets.length === 0) {
      throw new Error('No fields provided to update for OrbitObject');
    }

    sets.push('version = version + 1');
    sets.push('updated_at = now()');

    const result = await this.client.query(
      `UPDATE orbit_objects SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      const existing = await this.client.query('SELECT version FROM orbit_objects WHERE id = $1', [id]);
      if (existing.rowCount === 0) {
        throw new OrbitNotFoundError('OrbitObject', id);
      }
      throw new OrbitVersionConflictError(id, input.expectedVersion, existing.rows[0].version);
    }

    return mapOrbitObjectRow(result.rows[0]);
  }
}
