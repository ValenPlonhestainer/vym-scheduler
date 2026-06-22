-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0002 — RPCs SECURITY DEFINER para operaciones privilegiadas                  ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║ Reemplazan lo que hoy hace la service role key en:                           ║
-- ║   - registro owner / colaborador (creaban usuario + congregación + vínculo)  ║
-- ║   - validar/renovar licencia (lib/license.ts, pre-login)                     ║
-- ║   - chequeo de licencia activa (login + /api/check-sesion)                   ║
-- ║                                                                              ║
-- ║ La creación del USUARIO de auth se hace aparte con supabase.auth.signUp      ║
-- ║ (anon key); estas RPCs corren con el JWT del usuario ya creado (auth.uid()). ║
-- ║ SEGURO de aplicar: solo crea funciones, no afecta a la app corriendo.        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

BEGIN;

-- ── registrar_owner ───────────────────────────────────────────────────────────
-- El usuario ya hizo signUp (auth.uid() existe). Valida el token de licencia,
-- crea la congregación si el token aún no tiene, y vincula al usuario como owner.
CREATE OR REPLACE FUNCTION public.registrar_owner(p_codigo text, p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_tok   record;
  v_cong  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no_autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT active, congregation_name, congregacion_id
    INTO v_tok
    FROM tokens
   WHERE token = p_codigo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'token_no_encontrado';
  END IF;
  IF NOT v_tok.active THEN
    RAISE EXCEPTION 'token_inactivo';
  END IF;

  v_cong := v_tok.congregacion_id;

  IF v_cong IS NULL THEN
    -- Primera vez que se usa este token: crear la congregación y vincular el token
    INSERT INTO congregaciones (nombre)
    VALUES (COALESCE(NULLIF(v_tok.congregation_name, ''), p_nombre))
    RETURNING id INTO v_cong;

    UPDATE tokens SET congregacion_id = v_cong WHERE token = p_codigo;
  ELSE
    -- Ya tiene congregación: no debe existir otro owner
    IF EXISTS (
      SELECT 1 FROM congregacion_miembros
       WHERE congregacion_id = v_cong AND rol = 'owner'
    ) THEN
      RAISE EXCEPTION 'token_ya_registrado';
    END IF;
  END IF;

  INSERT INTO congregacion_miembros (user_id, congregacion_id, rol, nombre)
  VALUES (v_uid, v_cong, 'owner', p_nombre);

  RETURN v_cong;
END;
$$;

-- ── registrar_colaborador ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_colaborador(p_codigo text, p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_inv  record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no_autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT congregacion_id, usado
    INTO v_inv
    FROM invitaciones
   WHERE codigo = upper(p_codigo);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitacion_invalida';
  END IF;
  IF v_inv.usado THEN
    RAISE EXCEPTION 'invitacion_usada';
  END IF;

  INSERT INTO congregacion_miembros (user_id, congregacion_id, rol, nombre)
  VALUES (v_uid, v_inv.congregacion_id, 'colaborador', p_nombre);

  UPDATE invitaciones SET usado = true WHERE codigo = upper(p_codigo);

  RETURN v_inv.congregacion_id;
END;
$$;

-- ── validar_renovar_licencia ──────────────────────────────────────────────────
-- Pre-login: el usuario tipea el token de licencia. Devuelve los datos y, si está
-- activo, refresca last_renewed_at. Callable por anon (el caller prueba conocer el token).
CREATE OR REPLACE FUNCTION public.validar_renovar_licencia(p_token text)
RETURNS TABLE (found boolean, active boolean, congregation_name text, license_duration_days integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tok record;
BEGIN
  SELECT t.active, t.congregation_name, t.license_duration_days
    INTO v_tok
    FROM tokens t
   WHERE t.token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::text, NULL::integer;
    RETURN;
  END IF;

  IF v_tok.active THEN
    UPDATE tokens SET last_renewed_at = now() WHERE token = p_token;
  END IF;

  RETURN QUERY SELECT true, v_tok.active, v_tok.congregation_name, v_tok.license_duration_days;
END;
$$;

-- ── licencia_activa ───────────────────────────────────────────────────────────
-- Post-login: ¿la licencia de la congregación del usuario sigue activa?
-- Devuelve true si no hay token asociado (no bloquear por las dudas, igual que hoy).
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

  SELECT congregacion_id INTO v_cong
    FROM congregacion_miembros WHERE user_id = v_uid LIMIT 1;

  IF v_cong IS NULL THEN
    RETURN false;
  END IF;

  SELECT active INTO v_active FROM tokens WHERE congregacion_id = v_cong LIMIT 1;

  RETURN COALESCE(v_active, true);
END;
$$;

-- ── Permisos de ejecución ─────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.registrar_owner(text, text)        FROM public;
REVOKE ALL ON FUNCTION public.registrar_colaborador(text, text)  FROM public;
REVOKE ALL ON FUNCTION public.validar_renovar_licencia(text)     FROM public;
REVOKE ALL ON FUNCTION public.licencia_activa()                  FROM public;

GRANT EXECUTE ON FUNCTION public.registrar_owner(text, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_colaborador(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_renovar_licencia(text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.licencia_activa()                 TO authenticated;

COMMIT;
