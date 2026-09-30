create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author text not null default 'Baileys Team',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- add author column if table already existed without it
alter table announcements add column if not exists author text not null default 'Baileys Team';

-- public can read published announcements
alter table announcements enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'announcements' and policyname = 'anyone can read published announcements'
  ) then
    create policy "anyone can read published announcements"
      on announcements for select
      using (published = true);
  end if;
end $$;

-- index for listing published announcements by date
create index if not exists idx_announcements_published_created
  on announcements (created_at desc)
  where published = true;
