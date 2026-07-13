-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0006 — Flag de onboarding por usuario                                        ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║ Objetivo: mostrar el tutorial de bienvenida (mockups animados de cada        ║
-- ║ sección) la PRIMERA vez que un usuario entra — ya sea el owner que creó la    ║
-- ║ congregación con el token, o un colaborador que entró con código.            ║
-- ║                                                                              ║
-- ║ El flag vive en congregacion_miembros (una fila por usuario/congregación).   ║
-- ║ La lectura usa la política SELECT existente (miembros_read). La escritura va  ║
-- ║ por RPC SECURITY DEFINER (misma convención que las altas/bajas del sistema).  ║
-- ║ SEGURO de aplicar con la app corriendo: solo agrega columna + función.       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

BEGIN;

-- ── Columna del flag ──────────────────────────────────────────────────────────
ALTER TABLE public.congregacion_miembros
  ADD COLUMN IF NOT EXISTS onboarding_visto boolean NOT NULL DEFAULT false;

-- Los usuarios YA existentes no son "primera vez": los marcamos como vistos para
-- que el tutorial aparezca SOLO a cuentas nuevas (owner con token / colaborador
-- con código). Las membresías nuevas nacen con onboarding_visto = false (default).
-- ► Quitá este UPDATE si preferís que los usuarios actuales también lo vean una vez.
UPDATE public.congregacion_miembros SET onboarding_visto = true;

-- ── Marcar el tutorial como visto para el usuario logueado ────────────────────
-- Marca TODAS las membresías del usuario ⇒ semántica "una vez por usuario".
CREATE OR REPLACE FUNCTION public.marcar_onboarding_visto()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'no_autenticado' USING ERRCODE = '28000';
  END IF;

  UPDATE public.congregacion_miembros
     SET onboarding_visto = true
   WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_onboarding_visto() FROM public;
GRANT EXECUTE ON FUNCTION public.marcar_onboarding_visto() TO authenticated;

COMMIT;
