# Related-object queries

`PostgresRelationshipService.getRelatedObjects()` and
`PostgresQueryService.findByRelationship()` select objects with one database query.
Relationship constraints, title search, object type, status, owner and cursor bounds
all apply before ordering and limiting the result. A matching object appears once,
even when several relationships match it.

## Direction

| Relationship constraints | Returned objects |
| --- | --- |
| `sourceObjectId` | Targets of relationships from that source |
| `targetObjectId` only | Sources of relationships to that target |
| Both endpoint IDs | The target of relationships matching both IDs |
| Neither endpoint ID | Both endpoints of matching relationships, once per object |

`relationshipType`, when supplied, always constrains the same relationship record.
A self relationship can return its object in either direction. An isolated object
does not match an unanchored relationship query.

## Search and pagination

```ts
const first = await relationshipService.getRelatedObjects({
  sourceObjectId,
  relationshipType: 'supports',
  searchRequest: {
    query: 'evidence',
    objectType: 'evidence',
    status: 'active',
    ownerId
  },
  limit: 25
});

if (first.nextCursor) {
  const second = await relationshipService.getRelatedObjects({
    sourceObjectId,
    relationshipType: 'supports',
    searchRequest: {
      query: 'evidence', objectType: 'evidence', status: 'active', ownerId
    },
    limit: 25,
    cursor: first.nextCursor
  });
}
```

The outer `limit` and `cursor` control the combined result. Nested
`searchRequest.limit` and `searchRequest.cursor` are accepted for compatibility but
ignored; only the nested search filters apply. An empty search request adds no
filters. Title search retains the global search service's case-insensitive `ILIKE`
substring and wildcard behavior.

Pages default to 25 objects, ordered by `created_at DESC, id DESC`. A next cursor
is returned only when another matching object exists. Page limits must be positive
safe integers with room for the one-row lookahead. Malformed cursors are rejected.

Cursor timestamps are formatted in PostgreSQL as UTC strings with six fractional
digits. This preserves database microseconds that JavaScript `Date` cannot
represent. Global search and type queries use the same pagination implementation.
Restart existing page sequences after upgrading: old cursors serialized local
date strings and did not preserve this precision.

Pagination reflects the database at each request; it does not freeze a snapshot
across requests. Concurrent changes to objects or relationship membership can
change later pages.

## Regression tests

From the repository root:

```sh
pnpm test
pnpm typecheck
pnpm build
```

The ORBIT tests use PGlite by default to execute the SQL in an embedded PostgreSQL
engine without Docker. To run the same tests through the production `pg` driver:

```sh
ORBIT_TEST_DATABASE_URL=postgres://tmcc:tmcc@localhost:5432/tmcc_test pnpm test
```

The database user must be able to create and drop schemas. Each test run creates
its own schema, applies the actual object and relationship migrations, and removes
that schema afterward. Existing application tables are not truncated. CI starts
PostgreSQL 17 and runs this database-backed suite before the full build.

Coverage includes 60 matches across default pages, newer unrelated global search
hits, nonmatching related objects ahead of matching ones, all supported search
filters, empty filters, both directions, constrained endpoint pairs, shared
targets, multiple relationship types, self relationships, successive pages,
exact final pages, tied timestamps, microsecond precision, invalid limits and
malformed cursors. Concurrent writes and production-scale performance are not
covered by these regression tests.
