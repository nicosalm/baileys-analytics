-- seed-demo.sql
-- demo/playground tenant: "Lakeshore Retreats" in Door County, WI
-- run via Supabase SQL editor — idempotent (deletes existing demo data first)

BEGIN;

-- clean up any existing demo data (cascade through FKs)
DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE email = 'demo@baileysanalytics.com';
  IF v_tenant_id IS NOT NULL THEN
    DELETE FROM booking_tags WHERE booking_id IN (SELECT id FROM bookings WHERE tenant_id = v_tenant_id);
    DELETE FROM property_tags WHERE property_id IN (SELECT id FROM properties WHERE tenant_id = v_tenant_id);
    DELETE FROM booking_charges WHERE booking_id IN (SELECT id FROM bookings WHERE tenant_id = v_tenant_id);
    DELETE FROM blocks WHERE tenant_id = v_tenant_id;
    DELETE FROM bookings WHERE tenant_id = v_tenant_id;
    DELETE FROM guests WHERE tenant_id = v_tenant_id;
    DELETE FROM properties WHERE tenant_id = v_tenant_id;
    DELETE FROM tags WHERE tenant_id = v_tenant_id;
    DELETE FROM season_configurations WHERE tenant_id = v_tenant_id;
    DELETE FROM goals WHERE tenant_id = v_tenant_id;
    DELETE FROM tenants WHERE id = v_tenant_id;
  END IF;
END $$;

-- main seed block
DO $$
DECLARE
  v_tenant_id uuid;
  v_prop_bayview uuid;
  v_prop_harbor uuid;
  v_prop_sunset uuid;
  v_prop_eagle uuid;
  v_prop_cherry uuid;
  v_prop_northwoods uuid;
  v_prop_ids uuid[];
  v_prop_names text[];
  v_prop_bedrooms int[];
  v_prop_max_guests int[];
  v_prop_ownerrez_ids text[];
  v_cleaning_fees numeric[];

  -- guest tracking
  v_guest_ids uuid[];
  v_guest_names text[];
  v_guest_emails text[];
  v_guest_phones text[];
  v_guest_ownerrez_ids bigint[];
  v_guest_count int := 60;

  -- booking generation
  v_booking_id uuid;
  v_guest_idx int;
  v_prop_idx int;
  v_current_date date;
  v_arrival date;
  v_departure date;
  v_stay_nights int;
  v_nightly_rate numeric;
  v_total numeric;
  v_rent_amount numeric;
  v_cleaning numeric;
  v_tax numeric;
  v_platform text;
  v_platform_num text;
  v_status text;
  v_host_fee numeric;
  v_guest_fee numeric;
  v_booked_utc timestamptz;
  v_canceled_utc timestamptz;
  v_ownerrez_booking_id text;
  v_month int;
  v_rand float;
  v_booking_count int := 0;
  v_occupancy_chance float;
  v_adults int;
  v_children int;

  -- tags
  v_tag_vip uuid;
  v_tag_pet uuid;
  v_tag_repeat uuid;
  v_tag_direct uuid;
  v_tag_longstay uuid;
  v_tag_earlybird uuid;
  v_tag_lakefront uuid;
  v_tag_family uuid;

  -- temp
  v_first_names text[] := ARRAY[
    'James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda',
    'David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica',
    'Thomas','Sarah','Christopher','Karen','Charles','Lisa','Daniel','Nancy',
    'Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley',
    'Steven','Kimberly','Andrew','Emily','Paul','Donna','Joshua','Michelle',
    'Kenneth','Carol','Kevin','Amanda','Brian','Dorothy','George','Melissa',
    'Timothy','Deborah','Ronald','Stephanie','Jason','Rebecca','Edward','Sharon',
    'Ryan','Laura','Jacob','Cynthia'
  ];
  v_last_names text[] := ARRAY[
    'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
    'Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson',
    'Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson',
    'White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker',
    'Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill',
    'Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell',
    'Mitchell','Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz',
    'Parker','Cruz','Edwards','Collins'
  ];
  v_fn text;
  v_ln text;
BEGIN
  -- create tenant
  INSERT INTO tenants (id, email, user_id, ownerrez_connected, subscription_exempt, company_name, subscription_status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'demo@baileysanalytics.com',
    '00000000-0000-0000-0000-000000000000',
    true,
    true,
    'Lakeshore Retreats',
    'active',
    '2024-01-01'::timestamptz,
    now()
  )
  RETURNING id INTO v_tenant_id;

  -- create properties
  INSERT INTO properties (id, tenant_id, ownerrez_id, name, address, city, state, postal_code, bedrooms, bathrooms, max_guests, latitude, longitude, active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_tenant_id, '482917', 'Bayview Lodge', '8234 Ridges Rd', 'Baileys Harbor', 'WI', '54202', 4, 3, 10, 45.0658, -87.1228, true, '2024-01-01', now()),
    (gen_random_uuid(), v_tenant_id, '482918', 'Harbor Light Cottage', '4112 Main St', 'Fish Creek', 'WI', '54212', 2, 1, 6, 45.1286, -87.2356, true, '2024-01-01', now()),
    (gen_random_uuid(), v_tenant_id, '482919', 'Sunset Ridge Cabin', '9801 German Rd', 'Ephraim', 'WI', '54211', 3, 2, 8, 45.1533, -87.1664, true, '2024-01-01', now()),
    (gen_random_uuid(), v_tenant_id, '482920', 'Eagle Bluff House', '3340 Shore Rd', 'Ephraim', 'WI', '54211', 5, 4, 14, 45.1602, -87.2190, true, '2024-01-01', now()),
    (gen_random_uuid(), v_tenant_id, '482921', 'Cherry Lane Bungalow', '215 N 3rd Ave', 'Sturgeon Bay', 'WI', '54235', 2, 1, 4, 44.8342, -87.3770, true, '2024-01-01', now()),
    (gen_random_uuid(), v_tenant_id, '482922', 'Northwoods Retreat', '10542 Old Stage Rd', 'Sister Bay', 'WI', '54234', 3, 2, 8, 45.1889, -87.1205, true, '2024-01-01', now());

  -- fetch property ids in order
  SELECT array_agg(id ORDER BY name) INTO v_prop_ids FROM properties WHERE tenant_id = v_tenant_id;
  -- sorted by name: Bayview Lodge, Cherry Lane Bungalow, Eagle Bluff House, Harbor Light Cottage, Northwoods Retreat, Sunset Ridge Cabin
  v_prop_bayview := v_prop_ids[1];
  v_prop_cherry := v_prop_ids[2];
  v_prop_eagle := v_prop_ids[3];
  v_prop_harbor := v_prop_ids[4];
  v_prop_northwoods := v_prop_ids[5];
  v_prop_sunset := v_prop_ids[6];

  v_prop_names := ARRAY['Bayview Lodge','Cherry Lane Bungalow','Eagle Bluff House','Harbor Light Cottage','Northwoods Retreat','Sunset Ridge Cabin'];
  v_prop_bedrooms := ARRAY[4, 2, 5, 2, 3, 3];
  v_prop_max_guests := ARRAY[10, 4, 14, 6, 8, 8];
  v_prop_ownerrez_ids := ARRAY['482917','482921','482920','482918','482922','482919'];
  v_cleaning_fees := ARRAY[225, 125, 275, 150, 150, 175];

  -- create guests
  v_guest_ids := ARRAY[]::uuid[];
  v_guest_names := ARRAY[]::text[];
  v_guest_emails := ARRAY[]::text[];
  v_guest_phones := ARRAY[]::text[];
  v_guest_ownerrez_ids := ARRAY[]::bigint[];

  FOR i IN 1..v_guest_count LOOP
    v_fn := v_first_names[((i - 1) % array_length(v_first_names, 1)) + 1];
    v_ln := v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1];
    -- add slight variation to avoid exact dupes
    IF i > 30 THEN
      v_fn := v_first_names[((i + 7) % array_length(v_first_names, 1)) + 1];
      v_ln := v_last_names[((i + 13) % array_length(v_last_names, 1)) + 1];
    END IF;

    v_guest_ids := v_guest_ids || gen_random_uuid();
    v_guest_names := v_guest_names || (v_fn || ' ' || v_ln);
    v_guest_emails := v_guest_emails || (lower(v_fn) || '.' || lower(v_ln) || i::text || '@email.com');
    v_guest_phones := v_guest_phones || ('+1' || lpad((3120000000 + i * 7919)::text, 10, '0'));
    v_guest_ownerrez_ids := v_guest_ownerrez_ids || (900000 + i * 37)::bigint;
  END LOOP;

  -- insert guests
  FOR i IN 1..v_guest_count LOOP
    v_fn := split_part(v_guest_names[i], ' ', 1);
    v_ln := split_part(v_guest_names[i], ' ', 2);
    INSERT INTO guests (id, tenant_id, ownerrez_guest_id, first_name, last_name, full_name, email, phone, created_at, updated_at)
    VALUES (v_guest_ids[i], v_tenant_id, v_guest_ownerrez_ids[i], v_fn, v_ln, v_guest_names[i], v_guest_emails[i], v_guest_phones[i], '2024-01-01', now());
  END LOOP;

  -- create tags
  INSERT INTO tags (id, tenant_id, ownerrez_id, name, color, created_at, updated_at) VALUES
    (gen_random_uuid(), v_tenant_id, '10001', 'VIP', '#f59e0b', now(), now()),
    (gen_random_uuid(), v_tenant_id, '10002', 'Pet Friendly', '#10b981', now(), now()),
    (gen_random_uuid(), v_tenant_id, '10003', 'Repeat Guest', '#3b82f6', now(), now()),
    (gen_random_uuid(), v_tenant_id, '10004', 'Direct Booking', '#8b5cf6', now(), now()),
    (gen_random_uuid(), v_tenant_id, '10005', 'Long Stay', '#ec4899', now(), now()),
    (gen_random_uuid(), v_tenant_id, '10006', 'Early Bird', '#06b6d4', now(), now()),
    (gen_random_uuid(), v_tenant_id, '10007', 'Lakefront', '#14b8a6', now(), now()),
    (gen_random_uuid(), v_tenant_id, '10008', 'Family', '#f97316', now(), now());

  SELECT id INTO v_tag_vip FROM tags WHERE tenant_id = v_tenant_id AND name = 'VIP';
  SELECT id INTO v_tag_pet FROM tags WHERE tenant_id = v_tenant_id AND name = 'Pet Friendly';
  SELECT id INTO v_tag_repeat FROM tags WHERE tenant_id = v_tenant_id AND name = 'Repeat Guest';
  SELECT id INTO v_tag_direct FROM tags WHERE tenant_id = v_tenant_id AND name = 'Direct Booking';
  SELECT id INTO v_tag_longstay FROM tags WHERE tenant_id = v_tenant_id AND name = 'Long Stay';
  SELECT id INTO v_tag_earlybird FROM tags WHERE tenant_id = v_tenant_id AND name = 'Early Bird';
  SELECT id INTO v_tag_lakefront FROM tags WHERE tenant_id = v_tenant_id AND name = 'Lakefront';
  SELECT id INTO v_tag_family FROM tags WHERE tenant_id = v_tenant_id AND name = 'Family';

  -- property tags
  INSERT INTO property_tags (property_id, tag_id) VALUES
    (v_prop_bayview, v_tag_lakefront),
    (v_prop_bayview, v_tag_family),
    (v_prop_eagle, v_tag_lakefront),
    (v_prop_eagle, v_tag_family),
    (v_prop_harbor, v_tag_pet),
    (v_prop_northwoods, v_tag_pet),
    (v_prop_cherry, v_tag_pet),
    (v_prop_sunset, v_tag_lakefront);

  -- generate bookings
  -- we iterate month by month, property by property, placing bookings
  FOR v_prop_idx IN 1..6 LOOP
    v_current_date := '2024-01-01'::date;

    WHILE v_current_date < '2026-10-01'::date LOOP
      v_month := extract(month FROM v_current_date);

      -- seasonal occupancy probability (chance of placing a booking starting near this date)
      IF v_month IN (6, 7, 8) THEN
        v_occupancy_chance := 0.92;
      ELSIF v_month IN (9) THEN
        v_occupancy_chance := 0.75;
      ELSIF v_month IN (5, 10) THEN
        v_occupancy_chance := 0.55;
      ELSIF v_month IN (4) THEN
        v_occupancy_chance := 0.40;
      ELSIF v_month IN (11, 3) THEN
        v_occupancy_chance := 0.25;
      ELSE -- dec, jan, feb
        v_occupancy_chance := 0.15;
      END IF;

      v_rand := random();

      IF v_rand < v_occupancy_chance THEN
        -- determine stay length
        IF v_month IN (6, 7, 8) THEN
          v_stay_nights := 3 + floor(random() * 5)::int; -- 3-7 nights
        ELSIF v_month IN (5, 9, 10) THEN
          v_stay_nights := 2 + floor(random() * 4)::int; -- 2-5 nights
        ELSE
          v_stay_nights := 2 + floor(random() * 2)::int; -- 2-3 nights
        END IF;

        v_arrival := v_current_date;
        v_departure := v_arrival + v_stay_nights;

        -- don't go past our end date
        IF v_departure > '2026-09-30'::date THEN
          v_current_date := '2026-10-01'::date;
          CONTINUE;
        END IF;

        -- nightly rate based on season and property size
        IF v_month IN (6, 7, 8) THEN
          v_nightly_rate := (200 + floor(random() * 200) + v_prop_bedrooms[v_prop_idx] * 50)::numeric;
        ELSIF v_month IN (5, 9, 10) THEN
          v_nightly_rate := (150 + floor(random() * 100) + v_prop_bedrooms[v_prop_idx] * 35)::numeric;
        ELSE
          v_nightly_rate := (100 + floor(random() * 60) + v_prop_bedrooms[v_prop_idx] * 25)::numeric;
        END IF;

        v_cleaning := v_cleaning_fees[v_prop_idx];
        v_rent_amount := v_nightly_rate * v_stay_nights;
        v_tax := round((v_rent_amount + v_cleaning) * 0.11, 2);
        v_total := v_rent_amount + v_cleaning + v_tax;

        -- platform selection
        v_rand := random();
        IF v_rand < 0.40 THEN
          v_platform := 'Airbnb';
          v_host_fee := round(v_total * 0.03, 2);
          v_guest_fee := round(v_total * 0.15, 2);
        ELSIF v_rand < 0.65 THEN
          v_platform := 'VRBO';
          v_host_fee := 0;
          v_guest_fee := round(v_total * 0.12, 2);
        ELSIF v_rand < 0.85 THEN
          v_platform := 'Direct';
          v_host_fee := 0;
          v_guest_fee := 0;
        ELSIF v_rand < 0.95 THEN
          v_platform := 'Booking.com';
          v_host_fee := round(v_total * 0.03, 2);
          v_guest_fee := 0;
        ELSE
          v_platform := 'TripAdvisor';
          v_host_fee := round(v_total * 0.03, 2);
          v_guest_fee := 0;
        END IF;

        -- platform reservation number
        v_platform_num := NULL;
        IF v_platform = 'Airbnb' THEN
          v_platform_num := 'HM' || lpad((floor(random() * 99999999))::text, 8, '0');
        ELSIF v_platform = 'VRBO' THEN
          v_platform_num := 'HA-' || lpad((floor(random() * 9999999))::text, 7, '0');
        ELSIF v_platform = 'Booking.com' THEN
          v_platform_num := lpad((floor(random() * 9999999999))::text, 10, '0');
        END IF;

        -- status (15% cancellation)
        v_status := 'active';
        v_canceled_utc := NULL;
        IF random() < 0.15 THEN
          v_status := 'canceled';
          v_canceled_utc := (v_arrival - (floor(random() * 14) + 1)::int)::date::timestamptz;
        END IF;

        -- guest selection: 20% repeat guests (pick from first 12), rest from full pool
        IF random() < 0.20 THEN
          v_guest_idx := 1 + floor(random() * 12)::int;
        ELSE
          v_guest_idx := 1 + floor(random() * v_guest_count)::int;
        END IF;

        -- booked_utc: 7-90 days before arrival
        v_booked_utc := (v_arrival - (7 + floor(random() * 83))::int)::date::timestamptz + (floor(random() * 86400) || ' seconds')::interval;

        v_ownerrez_booking_id := (1000000 + v_booking_count * 3 + floor(random() * 3))::text;

        -- adults and children
        v_adults := 1 + floor(random() * least(v_prop_max_guests[v_prop_idx], 4))::int;
        v_children := 0;
        IF random() < 0.35 THEN
          v_children := floor(random() * 3)::int;
        END IF;

        INSERT INTO bookings (
          id, tenant_id, property_id, ownerrez_booking_id, arrival, departure,
          adults, children, infants, pets, guest_name, guest_email, guest_phone,
          total_amount, status, platform, platform_reservation_number,
          booked_utc, canceled_utc, host_service_fee, ownerrez_guest_id,
          guest_listing_site_fee, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), v_tenant_id, v_prop_ids[v_prop_idx], v_ownerrez_booking_id,
          v_arrival, v_departure, v_adults, v_children,
          CASE WHEN random() < 0.05 THEN 1 ELSE 0 END,
          CASE WHEN random() < 0.15 THEN 1 ELSE 0 END,
          v_guest_names[v_guest_idx], v_guest_emails[v_guest_idx], v_guest_phones[v_guest_idx],
          v_total, v_status, v_platform, v_platform_num,
          v_booked_utc, v_canceled_utc, v_host_fee, v_guest_ownerrez_ids[v_guest_idx]::text,
          v_guest_fee, greatest(v_booked_utc, '2024-01-01'::timestamptz), now()
        )
        RETURNING id INTO v_booking_id;

        -- booking_charges for non-canceled bookings
        IF v_status = 'active' THEN
          INSERT INTO booking_charges (id, booking_id, type, description, amount, is_taxable, position, created_at) VALUES
            (gen_random_uuid(), v_booking_id, 'rent', 'Nightly rate x ' || v_stay_nights || ' nights', v_rent_amount, true, 1, now()),
            (gen_random_uuid(), v_booking_id, 'surcharge', 'Cleaning fee', v_cleaning, true, 2, now()),
            (gen_random_uuid(), v_booking_id, 'tax', 'WI state + Door County tourism tax (11%)', v_tax, false, 3, now());

          -- credit card processing fee (~3%) for non-direct bookings
          IF v_platform != 'Direct' THEN
            INSERT INTO booking_charges (id, booking_id, type, description, amount, is_taxable, position, created_at)
            VALUES (gen_random_uuid(), v_booking_id, 'surcharge', 'Credit Card Fee (3%)', round(v_total * 0.03, 2), false, 4, now());
          END IF;

          -- occasional discount for long stays or direct bookings
          IF v_stay_nights >= 7 OR (v_platform = 'Direct' AND random() < 0.3) THEN
            INSERT INTO booking_charges (id, booking_id, type, description, amount, is_taxable, position, created_at)
            VALUES (gen_random_uuid(), v_booking_id, 'discount', 'Extended stay / loyalty discount', -round(v_rent_amount * 0.10, 2), false, 5, now());
          END IF;
        END IF;

        -- booking tags
        IF v_status = 'active' THEN
          -- long stay tag
          IF v_stay_nights >= 6 THEN
            INSERT INTO booking_tags (booking_id, tag_id) VALUES (v_booking_id, v_tag_longstay) ON CONFLICT DO NOTHING;
          END IF;
          -- direct booking tag
          IF v_platform = 'Direct' THEN
            INSERT INTO booking_tags (booking_id, tag_id) VALUES (v_booking_id, v_tag_direct) ON CONFLICT DO NOTHING;
          END IF;
          -- early bird (booked 60+ days before)
          IF v_arrival - v_booked_utc::date > 60 THEN
            INSERT INTO booking_tags (booking_id, tag_id) VALUES (v_booking_id, v_tag_earlybird) ON CONFLICT DO NOTHING;
          END IF;
          -- repeat guest tag (first 12 guests are our "repeats")
          IF v_guest_idx <= 12 THEN
            INSERT INTO booking_tags (booking_id, tag_id) VALUES (v_booking_id, v_tag_repeat) ON CONFLICT DO NOTHING;
          END IF;
          -- VIP tag (large bookings on big properties)
          IF v_total > 4000 AND v_prop_bedrooms[v_prop_idx] >= 4 THEN
            INSERT INTO booking_tags (booking_id, tag_id) VALUES (v_booking_id, v_tag_vip) ON CONFLICT DO NOTHING;
          END IF;
          -- family tag
          IF v_children > 0 THEN
            INSERT INTO booking_tags (booking_id, tag_id) VALUES (v_booking_id, v_tag_family) ON CONFLICT DO NOTHING;
          END IF;
        END IF;

        v_booking_count := v_booking_count + 1;

        -- advance past this booking + gap
        IF v_month IN (6, 7, 8) THEN
          v_current_date := v_departure + floor(random() * 2)::int; -- 0-1 day gap in summer
        ELSIF v_month IN (5, 9, 10) THEN
          v_current_date := v_departure + (1 + floor(random() * 4))::int; -- 1-4 day gap
        ELSE
          v_current_date := v_departure + (2 + floor(random() * 7))::int; -- 2-8 day gap
        END IF;
      ELSE
        -- no booking, skip forward
        IF v_month IN (6, 7, 8) THEN
          v_current_date := v_current_date + (2 + floor(random() * 3))::int;
        ELSIF v_month IN (5, 9, 10) THEN
          v_current_date := v_current_date + (3 + floor(random() * 5))::int;
        ELSE
          v_current_date := v_current_date + (5 + floor(random() * 10))::int;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'generated % bookings', v_booking_count;

  -- blocks: owner blocks and winter closures
  -- winter closures for 2 properties (Cherry Lane and Harbor Light — smaller properties)
  INSERT INTO blocks (id, tenant_id, property_id, ownerrez_block_id, arrival, departure, type, reason, created_at, updated_at) VALUES
    -- cherry lane winter closures
    (gen_random_uuid(), v_tenant_id, 482921, 50001, '2024-12-01', '2025-03-15', 'block', 'Winter closure', now(), now()),
    (gen_random_uuid(), v_tenant_id, 482921, 50002, '2025-12-01', '2026-03-15', 'block', 'Winter closure', now(), now()),
    -- harbor light winter closures
    (gen_random_uuid(), v_tenant_id, 482918, 50003, '2024-12-15', '2025-03-01', 'block', 'Winter closure', now(), now()),
    (gen_random_uuid(), v_tenant_id, 482918, 50004, '2025-12-15', '2026-03-01', 'block', 'Winter closure', now(), now()),
    -- owner personal use blocks
    (gen_random_uuid(), v_tenant_id, 482917, 50010, '2024-07-01', '2024-07-07', 'block', 'Owner use — 4th of July week', now(), now()),
    (gen_random_uuid(), v_tenant_id, 482920, 50011, '2024-12-20', '2025-01-02', 'block', 'Owner use — holidays', now(), now()),
    (gen_random_uuid(), v_tenant_id, 482917, 50012, '2025-07-01', '2025-07-07', 'block', 'Owner use — 4th of July week', now(), now()),
    (gen_random_uuid(), v_tenant_id, 482920, 50013, '2025-12-20', '2026-01-02', 'block', 'Owner use — holidays', now(), now()),
    (gen_random_uuid(), v_tenant_id, 482922, 50014, '2025-08-15', '2025-08-22', 'block', 'Owner use — family vacation', now(), now()),
    (gen_random_uuid(), v_tenant_id, 482919, 50015, '2026-06-20', '2026-06-27', 'block', 'Owner use — anniversary trip', now(), now());

  -- season configuration
  INSERT INTO season_configurations (id, tenant_id, name, start_month, start_day, end_month, end_day, is_active, created_at, updated_at)
  VALUES (gen_random_uuid(), v_tenant_id, 'Peak Season', 4, 25, 11, 3, true, now(), now());

  -- goals
  INSERT INTO goals (id, tenant_id, metric_key, target_value, is_enabled, period, created_at, updated_at) VALUES
    (gen_random_uuid(), v_tenant_id, 'revenue', 75000, true, 'monthly', now(), now()),
    (gen_random_uuid(), v_tenant_id, 'occupancy', 65, true, 'yearly', now(), now());

END $$;

COMMIT;
