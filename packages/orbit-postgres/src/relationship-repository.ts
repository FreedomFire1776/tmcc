import type { PoolClient } from 'pg';
import type { OrbitRelationship, OrbitRelationshipRepository, RelationshipQuery } from '@tmcc/orbit-kernel';
import { OrbitNotFoundError } from '@tmcc/orbit-kernel';

type PostgresClient = PoolClient;

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

  async findMany(query?: RelationshipQuery) {
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
}
