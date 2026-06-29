-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0005 — Oración de cierre (fin de semana) como texto libre                    ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║ En las reuniones de fin de semana la oración de cierre deja de ser una       ║
-- ║ asignación (hermano_id) y pasa a ser un campo de texto libre en la semana,   ║
-- ║ que se autocompleta con el nombre del orador de la disertación pública.      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

BEGIN;

ALTER TABLE public.semanas_fds
  ADD COLUMN IF NOT EXISTS oracion_cierre_texto text;

COMMIT;
