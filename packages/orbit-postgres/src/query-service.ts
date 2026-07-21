import type { Pool } from 'pg';
import type {
  ObjectQuery,
  OrbitObject,
  OrbitRelationship,
  ObjectType,
  OrbitStatus,
  Page,
  RelationshipQuery,
  UUID
} from '@tmcc/orbit-kernel';

export interface QueryPageRequest {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface QueryService {
  findById(id: UUID): Promise<OrbitObject | null>;
  findByType(objectType: ObjectType, request?: QueryPageRequest): Promise<Page<OrbitObject>>;
  findByRelationship(query: RelationshipQuery & QueryPageRequest): Promise<Page<OrbitObject>>;
}

interface CursorPayload {
  createdAt: string;
  id: UUID;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(`${payload.createdAt}|${payload.id}`).toString('base64');
}

function decodeCursor(cursor: string): CursorPayload {
  const decoded = Buffer.from(cursor, 'base64').toString('utf8');
  const [createdAt, id] = decoded.split('|');
  if (!createdAt || !id) {
    throw new Error('Invalid cursor');
  }
  return { createdAt, id: id as UUID };
}

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

export class PostgresQueryService implements QueryService {
  constructor(private readonly pool: Pool) {}

  async findById(id: UUID): Promise<OrbitObject | null> {
    const result = await this.pool.query('SELECT * FROM orbit_objects WHERE id = $1', [id]);
    return result.rowCount === 0 ? null : mapOrbitObjectRow(result.rows[0]);
  }

  async findByType(objectType: ObjectType, request: QueryPageRequest = {}) {
    const values: any[] = [objectType];
    let sql = 'SELECT * FROM orbit_objects WHERE object_type = $1';

    if (request.cursor) {
      const cursor = decodeCursor(request.cursor);
      values.push(cursor.createdAt, cursor.id);
      sql += ` AND (created_at < $${values.length - 1} OR (created_at = $${values.length - 1} AND id < $${values.length}))`;
    }

    sql += ' ORDER BY created_at DESC, id DESC';
    const limit = request.limit ?? 25;
    values.push(limit + 1);
    sql += ` LIMIT $${values.length}`;

    const result = await this.pool.query(sql, values);
    const items = result.rows.slice(0, limit).map(mapOrbitObjectRow);
    const nextCursor = result.rows.length > limit ? encodeCursor({ createdAt: result.rows[limit - 1].created_at, id: result.rows[limit - 1].id }) : undefined;

    return nextCursor ? { items, nextCursor } : { items };
  }

  async findByRelationship(query: RelationshipQuery & QueryPageRequest) {
    const filters: string[] = [];
    const values: any[] = [];

    let sql = `SELECT o.* FROM orbit_objects o JOIN orbit_relationships r ON o.id = r.source_object_id OR o.id = r.target_object_id`;

    if (query.sourceObjectId) {
      values.push(query.sourceObjectId);
      filters.push(`r.source_object_id = $${values.length}`);
    }

    if (query.targetObjectId) {
      values.push(query.targetObjectId);
      filters.push(`r.target_object_id = $${values.length}`);
    }

    if (query.relationshipType) {
      values.push(query.relationshipType);
      filters.push(`r.relationship_type = $${values.length}`);
    }

    if (filters.length > 0) {
      sql += ` WHERE ${filters.join(' AND ')}`;
    }

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      values.push(cursor.createdAt, cursor.id);
      sql += values.length > 0 ? ` AND (o.created_at < $${values.length - 1} OR (o.created_at = $${values.length - 1} AND o.id < $${values.length}))` : ` WHERE (o.created_at < $1 OR (o.created_at = $1 AND o.id < $2))`;
    }

    sql += ' ORDER BY o.created_at DESC, o.id DESC';
    const limit = query.limit ?? 25;
    values.push(limit + 1);
    sql += ` LIMIT $${values.length}`;

    const result = await this.pool.query(sql, values);
    const items = result.rows.slice(0, limit).map(mapOrbitObjectRow);
    const nextCursor = result.rows.length > limit ? encodeCursor({ createdAt: result.rows[limit - 1].created_at, id: result.rows[limit - 1].id }) : undefined;

    return nextCursor ? { items, nextCursor } : { items };
  }
}
