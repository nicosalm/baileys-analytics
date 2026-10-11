-- delete_tenant_data hit the API statement timeout (57014) on larger tenants: every
-- row deleted from a parent (bookings, properties, guests, tags, ...) made Postgres
-- seq-scan each referencing table, because most FK columns had no index.
-- Indexes every public FK not already covered by an index on exactly its columns,
-- so it is safe to run against a schema where some of these already exist.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl,
           left('idx_' || cl.relname || '_' || string_agg(a.attname, '_' order by k.ord), 63) as idx,
           string_agg(quote_ident(a.attname), ', ' order by k.ord) as cols
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
    cross join lateral unnest(c.conkey) with ordinality k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and i.indpred is null
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey
      )
    group by c.oid, cl.relname, c.conrelid
  loop
    execute format('create index if not exists %I on %s (%s)', r.idx, r.tbl, r.cols);
  end loop;
end $$;
