import type { PoolClient } from 'pg';
import type { OrbitRelationship, OrbitRelationshipRepository, RelationshipQuery, Metadata, Page } from '@tmcc/orbit-kernel';
import { OrbitNotFoundError, OrbitVersionConflictError } from '@tmcc/orbit-kernel';

type PostgresClient = PoolClient;

interface UpdateRelationshipInput {
  readonly relationshipType?: string;
  readonly metadata?: Metadata;
  readonly expectedVersion: number;
}

function mapOrbitRelationshipRow(row: any): OrbitRelationship {
  return {
    id: row.id,
    sourceObjectId: row.source_object_id,
    targetObjectId: row.target_object_id,
    relationshipType: row.relationship_type,
    metadata: row.metadata ?? {},
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PostgresOrbitRelationshipRepository implements OrbitRelationshipRepository {
  constructor(private readonly client: PostgresClient) {}

  async create(relationship: OrbitRelationship): Promise<OrbitRelationship> {
    const result = await this.client.query(
      `INSERT INTO orbit_relationships (
          id,
          source_object_id,
          target_object_id,
          relationship_type,
          metadata
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
      [
        relationship.id,
        relationship.sourceObjectId,
        relationship.targetObjectId,
        relationship.relationshipType,
        relationship.metadata ?? {}
      ]
    );

    return mapOrbitRelationshipRow(result.rows[0]);
  }

  async findById(id: string): Promise<OrbitRelationship | null> {
    const result = await this.client.query('SELECT * FROM orbit_relationships WHERE id = $1', [id]);
    return result.rowCount === 0 ? null : mapOrbitRelationshipRow(result.rows[0]);
  }

  async findMany(query?: RelationshipQuery): Promise<Page<OrbitRelationship>> {
    const filters: string[] = [];
    const values: any[] = [];

    if (query?.sourceObjectId) {
      values.push(query.sourceObjectId);
      filters.push(`source_object_id = $${values.length}`);
    }

    if (query?.targetObjectId) {
      values.push(query.targetObjectId);
      filters.push(`target_object_id = $${values.length}`);
    }

    if (query?.relationshipType) {
      values.push(query.relationshipType);
      filters.push(`relationship_type = $${values.length}`);
    }

    let sql = 'SELECT * FROM orbit_relationships';
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
      items: result.rows.map(mapOrbitRelationshipRow)
    };
  }

  async update(id: string, input: UpdateRelationshipInput): Promise<OrbitRelationship> {
    const sets: string[] = [];
    const values: any[] = [id, input.expectedVersion];

    if (input.relationshipType !== undefined) {
      values.push(input.relationshipType);
      sets.push(`relationship_type = $${values.length}`);
    }

    if (input.metadata !== undefined) {
      values.push(input.metadata);
      sets.push(`metadata = $${values.length}`);
    }

    if (sets.length === 0) {
      throw new Error('No fields provided to update for OrbitRelationship');
    }

    sets.push('version = version + 1');
    sets.push('updated_at = now()');

    const result = await this.client.query(
      `UPDATE orbit_relationships SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      const existing = await this.client.query('SELECT version FROM orbit_relationships WHERE id = $1', [id]);
      if (existing.rowCount === 0) {
        throw new OrbitNotFoundError('OrbitRelationship', id);
      }
      throw new OrbitVersionConflictError(id, input.expectedVersion, existing.rows[0].version);
    }

    return mapOrbitRelationshipRow(result.rows[0]);
  }

  async delete(id: string, expectedVersion: number): Promise<OrbitRelationship> {
    const result = await this.client.query(
      `DELETE FROM orbit_relationships WHERE id = $1 AND version = $2 RETURNING *`,
      [id, expectedVersion]
    );

    if (result.rowCount === 0) {
      const existing = await this.client.query('SELECT version FROM orbit_relationships WHERE id = $1', [id]);
      if (existing.rowCount === 0) {
        throw new OrbitNotFoundError('OrbitRelationship', id);
      }
      throw new OrbitVersionConflictError(id, expectedVersion, existing.rows[0].version);
    }

    return mapOrbitRelationshipRow(result.rows[0]);
  }
}
