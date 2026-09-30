-- widen properties.internal_code from varchar(10) to varchar(16) to match
-- ownerrez's upstream cap on the private code field (max length 16 per their api docs).
--
-- context: the 10-char cap was set assuming short codes like "CEC", "CNC" (jerry's
-- door county cottages). pacific view lodging has 45 properties with street-address
-- slugs up to 16 chars (e.g. "670 - SE 39th St"), causing initial sync to fail with
-- sqlstate 22001 "value too long for type character varying(10)".

ALTER TABLE properties ALTER COLUMN internal_code TYPE varchar(16);
