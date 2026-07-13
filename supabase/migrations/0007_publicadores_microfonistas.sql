-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0007 — Publicadores microfonistas por defecto                               ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║ Ahora el privilegio "Microfonista" (privilegios.microfonos) es visible y     ║
-- ║ revocable para los publicadores, y el selector de micrófonos lo respeta.     ║
-- ║                                                                              ║
-- ║ Hasta hoy TODOS los publicadores aparecían como microfonistas (el selector   ║
-- ║ ignoraba el flag). Para no cambiarles el comportamiento, marcamos a los       ║
-- ║ publicadores YA existentes con microfonos = true. Desde el diálogo de         ║
-- ║ hermanos se puede desmarcar cuando haga falta.                               ║
-- ║ SEGURO de aplicar: solo actualiza el JSONB de privilegios de publicadores.   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

BEGIN;

UPDATE public.hermanos
   SET privilegios = jsonb_set(
         COALESCE(privilegios, '{}'::jsonb),
         '{microfonos}',
         'true'::jsonb,
         true
       )
 WHERE rol = 'publicador'
   AND COALESCE((privilegios ->> 'microfonos')::boolean, false) = false;

COMMIT;
