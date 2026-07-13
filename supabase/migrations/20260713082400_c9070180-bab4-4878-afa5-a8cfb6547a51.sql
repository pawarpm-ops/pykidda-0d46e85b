-- System health logs
CREATE TABLE public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('ai','pdf','login','api','performance','pyodide')),
  module_name TEXT,
  page_route TEXT,
  user_id UUID,
  user_email TEXT,
  error_message TEXT NOT NULL,
  error_details JSONB,
  status_code INTEGER,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','resolved')),
  device_info JSONB,
  duration_ms INTEGER,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shl_created_at ON public.system_health_logs (created_at DESC);
CREATE INDEX idx_shl_category_created ON public.system_health_logs (category, created_at DESC);
CREATE INDEX idx_shl_severity ON public.system_health_logs (severity, created_at DESC);
CREATE INDEX idx_shl_status ON public.system_health_logs (status, created_at DESC);
CREATE INDEX idx_shl_user ON public.system_health_logs (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_health_logs TO authenticated;
GRANT ALL ON public.system_health_logs TO service_role;

ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all
CREATE POLICY "Admins can view all health logs"
  ON public.system_health_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins can update (mark reviewed/resolved)
CREATE POLICY "Admins can update health logs"
  ON public.system_health_logs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins can delete
CREATE POLICY "Admins can delete health logs"
  ON public.system_health_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- All writes go via SECURITY DEFINER RPCs; no direct INSERT policy needed.

-- RPC: log an event (works for authenticated users; captures user_id/email if present)
CREATE OR REPLACE FUNCTION public.log_system_health_event(
  _category TEXT,
  _error_message TEXT,
  _module_name TEXT DEFAULT NULL,
  _page_route TEXT DEFAULT NULL,
  _severity TEXT DEFAULT 'medium',
  _status_code INTEGER DEFAULT NULL,
  _error_details JSONB DEFAULT NULL,
  _device_info JSONB DEFAULT NULL,
  _duration_ms INTEGER DEFAULT NULL,
  _user_email TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _email TEXT := _user_email;
  _new_id UUID;
BEGIN
  IF _category NOT IN ('ai','pdf','login','api','performance','pyodide') THEN
    RAISE EXCEPTION 'Invalid category: %', _category;
  END IF;
  IF _severity NOT IN ('low','medium','high','critical') THEN
    _severity := 'medium';
  END IF;

  IF _uid IS NOT NULL AND _email IS NULL THEN
    BEGIN
      SELECT email::text INTO _email FROM auth.users WHERE id = _uid;
    EXCEPTION WHEN OTHERS THEN
      _email := NULL;
    END;
  END IF;

  INSERT INTO public.system_health_logs(
    category, module_name, page_route, user_id, user_email,
    error_message, error_details, status_code, severity,
    device_info, duration_ms
  ) VALUES (
    _category, _module_name, _page_route, _uid, _email,
    left(_error_message, 4000), _error_details, _status_code, _severity,
    _device_info, _duration_ms
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_system_health_event(TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,JSONB,JSONB,INTEGER,TEXT) TO authenticated, anon;

-- Summary RPC: counts for today by category (admin-only enforced in caller)
CREATE OR REPLACE FUNCTION public.system_health_summary()
RETURNS TABLE(category TEXT, count_today BIGINT, count_7d BIGINT, critical_today BIGINT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.category,
    COUNT(*) FILTER (WHERE l.created_at >= (now() AT TIME ZONE 'Asia/Kolkata')::date) AS count_today,
    COUNT(*) FILTER (WHERE l.created_at >= now() - INTERVAL '7 days') AS count_7d,
    COUNT(*) FILTER (WHERE l.created_at >= (now() AT TIME ZONE 'Asia/Kolkata')::date AND l.severity = 'critical') AS critical_today
  FROM (VALUES ('ai'),('pdf'),('login'),('api'),('performance'),('pyodide')) AS c(category)
  LEFT JOIN public.system_health_logs l ON l.category = c.category
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
  GROUP BY c.category
  ORDER BY c.category;
$$;

GRANT EXECUTE ON FUNCTION public.system_health_summary() TO authenticated;