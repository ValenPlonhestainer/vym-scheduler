-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0004 — Cuenta admin global que entra a TODAS las congregaciones              ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║ Una cuenta de auth marcada como admin queda vinculada (rol='admin') a cada   ║
-- ║ congregación: a las existentes (backfill) y a las nuevas (trigger). Así el   ║
-- ║ admin puede elegir congregación en el login y saltar entre ellas sin tocar   ║
-- ║ la app Electron (todo corre del lado web/DB).                                ║
-- ║                                                                              ║
-- ║ Cambios:                                                                     ║
-- ║   1. Permitir múltiples membresías por usuario (quitar UNIQUE(user_id)).     ║
-- ║   2. Permitir rol='admin' (quitar CHECK sobre rol si lo limitaba).           ║
-- ║   3. Tabla app_admins + RPC para vincular + trigger en nuevas congregaciones.║
-- ║   4. licencia_activa() devuelve true para admins (no los traba una licencia).║
-- ║ SEGURO con la app actual: usuarios normales tienen 1 sola membresía, su      ║
-- ║ comportamiento no cambia.                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

BEGIN;

-- ── 1) Quitar UNIQUE(user_id) (constraint o índice) si existiera ───────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'congregacion_miembros'
      AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname::text)
        FROM unnest(con.conkey) AS k(attnum)
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
      ) = ARRAY['user_id']
  LOOP
    EXECUTE format('ALTER TABLE public.congregacion_miembros DROP CONSTRAINT %I', r.conname);
  END LOOP;

  FOR r IN
    SELECT c2.relname AS idxname
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_class c2 ON c2.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'congregacion_miembros'
      AND i.indisunique AND NOT i.indisprimary
      AND (
        SELECT array_agg(att.attname::text)
        FROM unnest(i.indkey) AS k(attnum)
        JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = k.attnum
      ) = ARRAY['user_id']
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.idxname);
  END LOOP;
END $$;

-- Evita duplicados exactos (mismo user en la misma congregación).
CREATE UNIQUE INDEX IF NOT EXISTS congregacion_miembros_user_cong_uniq
  ON public.congregacion_miembros (user_id, congregacion_id);

-- ── 2) Permitir rol='admin' (quitar CHECK que limitara los valores de rol) ─────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'congregacion_miembros'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%rol%'
  LOOP
    EXECUTE format('ALTER TABLE public.congregacion_miembros DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- ── 3) Registro de cuentas admin globales ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id    uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS ON sin políticas: solo accesible vía service role / SECURITY DEFINER.
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- Vincula un admin a TODAS las congregaciones existentes (idempotente).
CREATE OR REPLACE FUNCTION public.vincular_admin_a_todas(p_user_id uuid, p_nombre text DEFAULT 'Administrador')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO congregacion_miembros (user_id, congregacion_id, rol, nombre)
  SELECT p_user_id, c.id, 'admin', p_nombre
  FROM congregaciones c
  WHERE NOT EXISTS (
    SELECT 1 FROM congregacion_miembros m
    WHERE m.user_id = p_user_id AND m.congregacion_id = c.id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Trigger: cada congregación nueva engancha automáticamente a todos los admins.
CREATE OR REPLACE FUNCTION public.tg_vincular_admins_nueva_cong()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO congregacion_miembros (user_id, congregacion_id, rol, nombre)
  SELECT a.user_id, NEW.id, 'admin', 'Administrador'
  FROM app_admins a
  WHERE NOT EXISTS (
    SELECT 1 FROM congregacion_miembros m
    WHERE m.user_id = a.user_id AND m.congregacion_id = NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vincular_admins ON public.congregaciones;
CREATE TRIGGER trg_vincular_admins
  AFTER INSERT ON public.congregaciones
  FOR EACH ROW EXECUTE FUNCTION public.tg_vincular_admins_nueva_cong();

-- ── 4) licencia_activa(): los admins nunca quedan bloqueados ───────────────────
CREATE OR REPLACE FUNCTION public.licencia_activa()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_cong   uuid;
  v_active boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Las cuentas admin no dependen de ninguna licencia.
  IF EXISTS (SELECT 1 FROM app_admins WHERE user_id = v_uid) THEN
    RETURN true;
  END IF;

  SELECT congregacion_id INTO v_cong
    FROM congregacion_miembros WHERE user_id = v_uid LIMIT 1;

  IF v_cong IS NULL THEN
    RETURN false;
  END IF;

  SELECT active INTO v_active FROM tokens WHERE congregacion_id = v_cong LIMIT 1;

  RETURN COALESCE(v_active, true);
END;
$$;

-- ── Permisos ───────────────────────────────────────────────────────────────────
-- Estas funciones solo las invoca el panel admin (service role). No las exponemos.
REVOKE ALL ON FUNCTION public.vincular_admin_a_todas(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.vincular_admin_a_todas(uuid, text) TO service_role;

COMMIT;
