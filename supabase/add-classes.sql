-- ===========================================================================
-- AGS Dismissal — top up the class list
-- ---------------------------------------------------------------------------
-- Adds any classes that do not exist yet. It only ever INSERTS: existing
-- classes, their students and their teachers are left exactly as they are, so
-- it is safe to run on a school that is already using the app, and safe to run
-- twice.
--
-- Set the two numbers below to how many sections the school actually has, then
-- paste the whole file into the Supabase SQL editor and run it.
--
-- To go the other way — a class that should not exist — delete it from
-- Classes in the app. A class with students in it cannot be deleted until
-- they are moved.
-- ===========================================================================

do $$
declare
  -- ------------------------------------------------------------- settings --
  -- Kindergarten sections are lettered, and mixed: KG1-A … KG1-D.
  -- Maximum 6 (A–F); the app does not show more than that.
  v_kg_sections int := 4;

  -- Grades 1–12 are split boys / girls and numbered: 7b1 … 7b6, 7g1 … 7g6.
  -- Maximum 6; the app does not show more than that.
  v_sections    int := 6;
  -- ----------------------------------------------------------------------- --

  v_school  uuid;
  v_level   text;
  v_gender  text;
  v_section int;
  v_code    text;
  v_added   int := 0;
  v_before  int;
begin
  if to_regclass('public.classrooms') is null then
    raise exception
      'The AGS Dismissal schema is not installed yet. Run supabase/install.sql first.'
      using errcode = '42P01';
  end if;

  if v_kg_sections < 1 or v_kg_sections > 6 or v_sections < 1 or v_sections > 6 then
    raise exception 'Both section counts must be between 1 and 6.' using errcode = '22023';
  end if;

  select id into v_school from public.schools where slug = 'ags';
  if v_school is null then
    raise exception
      'No school found. Run supabase/setup.sql first.'
      using errcode = 'P0002';
  end if;

  select count(*) into v_before from public.classrooms where school_id = v_school;

  -- Kindergarten: mixed, lettered.
  foreach v_level in array array['KG1', 'KG2', 'KG3'] loop
    for v_section in 1 .. v_kg_sections loop
      v_code := v_level || '-' || chr(64 + v_section);
      insert into public.classrooms (school_id, name, grade, level, gender, section)
      values (v_school, v_code, 'KG ' || right(v_level, 1), v_level, 'mixed', chr(64 + v_section))
      on conflict (school_id, name) do nothing;
    end loop;
  end loop;

  -- Grades 1–12: split, numbered.
  for v_level in select generate_series(1, 12)::text loop
    foreach v_gender in array array['boys', 'girls'] loop
      for v_section in 1 .. v_sections loop
        v_code := v_level || substr(v_gender, 1, 1) || v_section;
        insert into public.classrooms (school_id, name, grade, level, gender, section)
        values (v_school, v_code, 'Grade ' || v_level, v_level,
                v_gender::public.class_gender, v_section::text)
        on conflict (school_id, name) do nothing;
      end loop;
    end loop;
  end loop;

  select count(*) - v_before into v_added
    from public.classrooms where school_id = v_school;

  raise notice 'Added % classes. The school now has %.',
    v_added, (select count(*) from public.classrooms where school_id = v_school);
end;
$$;

-- If you do not see these rows, the paste was cut short — run the file again.
select
  case when level like 'KG%' then 'Kindergarten' else 'Grade ' || level end as stage,
  gender,
  count(*)                        as sections,
  string_agg(name, ', ' order by section) as classes
from public.classrooms
group by 1, 2, level
order by (case when level like 'KG%' then 0 else level::int end), gender;
