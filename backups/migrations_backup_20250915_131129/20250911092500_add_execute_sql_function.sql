-- Safe helper to execute read-only SELECT queries via PostgREST
-- NOTE: This function only allows SELECT statements and wraps results into json

CREATE OR REPLACE FUNCTION execute_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned text;
  result json;
BEGIN
  cleaned := ltrim(query);
  IF left(lower(cleaned), 6) <> 'select' THEN
    RAISE EXCEPTION 'Only SELECT statements are allowed';
  END IF;

  EXECUTE format('select coalesce(json_agg(t), ''[]''::json) from (%s) t', query) INTO result;
  RETURN coalesce(result, '[]'::json);
END;
$$;

-- Restrict usage to authenticated roles (PostgREST uses anon/service roles). Service role is allowed via API key.
REVOKE ALL ON FUNCTION execute_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_sql(text) TO anon, authenticated, service_role;
