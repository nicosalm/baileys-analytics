-- announcements are now static HTML pages in apps/web/public/updates/
-- the DB table and API layer are no longer needed
drop table if exists announcements cascade;
