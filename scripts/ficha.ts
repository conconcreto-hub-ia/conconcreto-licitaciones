// Genera la ficha de una oportunidad (por código) o de todas las que no tienen. 4 a la vez.
import "./_env";
import { db } from "../src/lib/db";
import { generarFicha } from "../src/lib/ficha";
(async () => {
  const codigo = process.argv[2];
  const os = await db.oportunidad.findMany({ where: codigo ? { codigo } : { origen: "secop", fichaGeneradaEn: null } });
  const cola = [...os];
  const trabajador = async () => {
    for (let o = cola.shift(); o; o = cola.shift()) {
      const t = Date.now();
      try { const f = await generarFicha(o.id).catch(() => generarFicha(o.id)); console.log(`✓ ${f.recomendacion.padEnd(7)} ${String(f.encaje).padStart(3)} · ${f.titulo_corto} · ${((Date.now() - t) / 1000).toFixed(0)}s`); }
      catch (e) { console.log(`✗ ${o.codigo}: ${e instanceof Error ? e.message.slice(0, 200) : e}`); }
    }
  };
  await Promise.all([1, 2, 3, 4].map(trabajador));
})().finally(() => db.$disconnect());
