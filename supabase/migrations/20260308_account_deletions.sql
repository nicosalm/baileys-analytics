-- tracks account deletions for audit purposes
-- inserted before data is wiped so we retain a record
create table account_deletions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  email text not null,
  company_name text,
  deleted_by text not null, -- 'self' or admin email
  reason text, -- optional context
  property_count int not null default 0,
  booking_count int not null default 0,
  had_active_subscription boolean not null default false,
  deleted_at timestamptz not null default now()
);

create index idx_account_deletions_deleted_at on account_deletions (deleted_at desc);
