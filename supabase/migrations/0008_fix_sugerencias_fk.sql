-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0008 — Corrige la FK de sugerencias                                          ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║ BUG: la migración 0003 creó sugerencias.congregation_id apuntando a la tabla ║
-- ║ LEGACY congregations(id). El sistema VIVO usa congregaciones(id) (ver 0001). ║
-- ║ Las congregaciones creadas por el RPC de registro (0002) SOLO existen en     ║
-- ║ congregaciones, por lo que insertar una sugerencia rompía la FK             ║
-- ║ "sugerencias_congregation_id_fkey" con violación de clave foránea.           ║
-- ║                                                                              ║
-- ║ Fix: repuntar la FK a congregaciones(id). Idempotente y seguro.             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

BEGIN;

ALTER TABLE public.sugerencias
  DROP CONSTRAINT IF EXISTS sugerencias_congregation_id_fkey;

ALTER TABLE public.sugerencias
  ADD CONSTRAINT sugerencias_congregation_id_fkey
  FOREIGN KEY (congregation_id)
  REFERENCES public.congregaciones(id)
  ON DELETE CASCADE;

COMMIT;
