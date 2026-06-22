-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0003 — Tabla de sugerencias                                                  ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║ Los usuarios dejan sugerencias para mejorar la app. Misma RLS por            ║
-- ║ congregación que las tablas de datos (cong_isolation + auth_congregacion_ids ║
-- ║ definidos en 0001). El dev las lee con la service role key (saltea RLS).     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

BEGIN;

CREATE TABLE IF NOT EXISTS public.sugerencias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id  uuid NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  texto            text NOT NULL,
  created_by       uuid DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sugerencias_cong ON public.sugerencias(congregation_id);

ALTER TABLE public.sugerencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cong_isolation ON public.sugerencias;
CREATE POLICY cong_isolation ON public.sugerencias
  FOR ALL TO authenticated
  USING (congregation_id IN (SELECT public.auth_congregacion_ids()))
  WITH CHECK (congregation_id IN (SELECT public.auth_congregacion_ids()));

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.sugerencias FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.sugerencias FROM authenticated;

COMMIT;
