-- PostgREST 14 retries custom 40001 errors indefinitely. Business revision
-- conflicts must return HTTP 409 instead. Keep each installed function body,
-- ownership, ACL, search_path and SECURITY INVOKER behavior intact.
DO $migration$
DECLARE
  signature text;
  definition text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.luki_home_save_state(jsonb,bigint)',
    'public.luki_home_save_state_v2(jsonb,bigint)',
    'public.luki_home_save_state_v3(jsonb,bigint)'
  ] LOOP
    IF to_regprocedure(signature) IS NULL THEN
      RAISE EXCEPTION 'Missing expected function: %', signature;
    END IF;
    definition := pg_get_functiondef(to_regprocedure(signature));
    IF position('''40001''' in definition) = 0
       AND position('''PT409''' in definition) = 0 THEN
      RAISE EXCEPTION 'Missing expected revision guard: %', signature;
    END IF;
    EXECUTE replace(definition, '''40001''', '''PT409''');
  END LOOP;
END
$migration$;
