-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0001 — RLS por congregación (anon key + JWT)                                ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║ Objetivo: que el cliente Electron pueda usar la ANON key + el JWT del        ║
-- ║ usuario en vez de la SERVICE ROLE key. RLS aísla los datos por congregación. ║
-- ║                                                                              ║
-- ║ SEGURO de aplicar con la app actual corriendo: el cliente todavía usa la     ║
-- ║ service role key, que IGNORA RLS. Las políticas solo entran a jugar cuando   ║
-- ║ el cliente pase a anon key + JWT (fase posterior).                           ║
-- ║                                                                              ║
-- ║ Sistema de congregación VIVO: congregaciones (es) + congregacion_miembros.   ║
-- ║ La tabla congregations (en) es legacy y no se toca acá.                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

BEGIN;

-- ── Helper: ids de congregación del usuario logueado ──────────────────────────
-- SECURITY DEFINER para leer congregacion_miembros SALTEANDO su propia RLS y así
-- evitar recursión infinita cuando las políticas la consultan.
CREATE OR REPLACE FUNCTION public.auth_congregacion_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT congregacion_id
  FROM public.congregacion_miembros
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.auth_congregacion_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.auth_congregacion_ids() TO authenticated;

-- ── Tablas de datos (tienen congregation_id) ──────────────────────────────────
-- hermanos, semanas, asignaciones, semanas_fds, asignaciones_fds
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hermanos','semanas','asignaciones','semanas_fds','asignaciones_fds']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS cong_isolation ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY cong_isolation ON public.%I
        FOR ALL TO authenticated
        USING (congregation_id IN (SELECT public.auth_congregacion_ids()))
        WITH CHECK (congregation_id IN (SELECT public.auth_congregacion_ids()))
    $f$, t);
  END LOOP;
END $$;

-- ── congregaciones: el usuario ve/edita solo la(s) suya(s) ────────────────────
ALTER TABLE public.congregaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cong_self ON public.congregaciones;
CREATE POLICY cong_self ON public.congregaciones
  FOR ALL TO authenticated
  USING (id IN (SELECT public.auth_congregacion_ids()))
  WITH CHECK (id IN (SELECT public.auth_congregacion_ids()));

-- ── congregacion_miembros: SOLO lectura de la propia congregación ─────────────
-- Las altas/bajas se hacen vía RPC SECURITY DEFINER (registro/invitaciones).
ALTER TABLE public.congregacion_miembros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS miembros_read ON public.congregacion_miembros;
CREATE POLICY miembros_read ON public.congregacion_miembros
  FOR SELECT TO authenticated
  USING (congregacion_id IN (SELECT public.auth_congregacion_ids()));

-- ── invitaciones: el usuario gestiona las de su congregación ──────────────────
-- (Canjear una invitación al registrarse va por RPC, no por esta política.)
ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inv_manage ON public.invitaciones;
CREATE POLICY inv_manage ON public.invitaciones
  FOR ALL TO authenticated
  USING (congregacion_id IN (SELECT public.auth_congregacion_ids()))
  WITH CHECK (congregacion_id IN (SELECT public.auth_congregacion_ids()));

-- ── tokens: queda con RLS ON y SIN políticas (bloqueada) ──────────────────────
-- Se accede solo vía RPC SECURITY DEFINER (validar/renovar licencia). Ya estaba ON.
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

-- ── Endurecer grants: TRUNCATE NO lo filtra RLS; TRIGGER/REFERENCES de más ────
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

COMMIT;
