// Consolidación de suministros, con las reglas del skill de Jhon (sesión 3).
//
// Aplica SOLO a paquetes de suministro de concreto premezclado, acero de refuerzo (con su malla
// electrosoldada convencional) y bloques o ladrillos. En vez de transcribir actividades, se calcula
// el material y se presenta UN total por tipo para todo el proyecto:
//   · concreto: por resistencia (f'c) y características especiales, en m³. Las actividades en m² se
//     convierten con el espesor de la descripción (e = 0,20 m).
//   · acero: por grado (fy), en kg. La malla electrosoldada va como línea aparte, en su unidad.
//   · bloques: unidades por m² = 1 / ((largo + junta) × (alto + junta)).
//   · se suma exacto y cada total se redondea HACIA ARRIBA al entero, sin desperdicio adicional.
// Lo que no se puede convertir (falta el espesor, la resistencia o las dimensiones) NO se supone:
// queda como pendiente, a la vista, y su actividad sigue transcrita tal cual en el BIMBAU.
//
// Todo esto es código. El modelo no calcula cantidades.

type Act = { id: string; codigo: string | null; descripcion: string; unidad: string | null; cantidad: number | null; orden: number };

export type Fuente = { actividadId: string; codigo: string | null; descripcion: string; unidad: string | null; cantidad: number | null; factor: number; calculada: number; nota: string };
export type LineaBimbau = { descripcion: string; unidad: string; cantidad: number; fuentes: Fuente[]; transcrita?: boolean; codigo?: string | null };
export type Consolidacion = { tipo: "concreto" | "acero" | "mamposteria"; lineas: LineaBimbau[]; pendientes: { actividadId: string; codigo: string | null; descripcion: string; motivo: string }[] };

const n = (s: string) => Number(s.replace(",", "."));
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const unidad = (u: string | null) => norm(u ?? "").replace(/[^a-z0-9]/g, "").replace(/^mt/, "m");

export function tipoConsolidable(nombre: string): Consolidacion["tipo"] | null {
  const t = norm(nombre);
  if (/concreto/.test(t) && !/mano de obra|estructura en concreto/.test(t)) return "concreto";
  if (/acero|malla|refuerzo/.test(t)) return "acero";
  if (/bloque|ladrillo|mamposter/.test(t) && !/mano de obra/.test(t)) return "mamposteria";
  return null;
}

/** Espesor en metros desde la descripción: «e=0.20 m», «e = 20 cm», «espesor 0,15». */
function espesor(desc: string): number | null {
  const m = norm(desc).match(/(?:\be\s*=\s*|espesor\s*(?:de\s*)?)(\d+(?:[.,]\d+)?)\s*(cm|m)?/);
  if (!m) return null;
  const v = n(m[1]);
  return m[2] === "cm" || v > 2 ? v / 100 : v;
}

function concreto(acts: Act[]): Consolidacion {
  const grupos = new Map<string, LineaBimbau>();
  const pendientes: Consolidacion["pendientes"] = [];
  for (const a of acts) {
    const d = norm(a.descripcion);
    const fc = d.match(/f'?\s*c\s*=?\s*(\d+(?:[.,]\d+)?)\s*mpa/);
    const u = unidad(a.unidad);
    if (!fc) { pendientes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, motivo: "No dice la resistencia del concreto (f'c)." }); continue; }
    if (a.cantidad === null) { pendientes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, motivo: "No tiene cantidad." }); continue; }
    let factor: number, nota: string;
    if (u === "m3") { factor = 1; nota = "Ya está en m³"; }
    else if (u === "m2") {
      const e = espesor(a.descripcion);
      if (!e) { pendientes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, motivo: "Está en m² y no dice el espesor: no se puede pasar a m³." }); continue; }
      factor = e; nota = `m² × espesor ${e.toLocaleString("es-CO")} m (de la descripción)`;
    } else { pendientes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, motivo: `Está en ${a.unidad ?? "una unidad sin decir"}: no se puede pasar a m³ sin la sección.` }); continue; }
    const especial = ["impermeabilizado", "tremie", "lanzado", "fibra", "autocompactante"].filter((x) => d.includes(x));
    const clave = `${n(fc[1])}|${especial.join(",")}`;
    const linea = grupos.get(clave) ?? { descripcion: `Suministro de concreto f'c = ${n(fc[1]).toLocaleString("es-CO")} MPa${especial.length ? ` ${especial.join(", ")}` : ""}`, unidad: "M3", cantidad: 0, fuentes: [] };
    const calculada = a.cantidad * factor;
    linea.fuentes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, unidad: a.unidad, cantidad: a.cantidad, factor, calculada, nota });
    grupos.set(clave, linea);
  }
  const lineas = [...grupos.values()]
    .map((l) => ({ ...l, cantidad: Math.ceil(l.fuentes.reduce((s, f) => s + f.calculada, 0) - 1e-9) }))
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es", { numeric: true }));
  return { tipo: "concreto", lineas, pendientes };
}

function acero(acts: Act[]): Consolidacion {
  const grupos = new Map<string, LineaBimbau>();
  const pendientes: Consolidacion["pendientes"] = [];
  for (const a of acts) {
    const d = norm(a.descripcion);
    if (a.cantidad === null) { pendientes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, motivo: "No tiene cantidad." }); continue; }
    if (/malla/.test(d)) {
      const ref = a.descripcion.match(/malla\s+electrosoldada\s+([A-Za-z]-?\s?\d+[A-Za-z0-9-]*)/i)?.[1] ?? "";
      const clave = `malla|${ref}|${unidad(a.unidad)}`;
      const linea = grupos.get(clave) ?? { descripcion: `Suministro de malla electrosoldada${ref ? ` ${ref}` : ""}`, unidad: (a.unidad ?? "").toUpperCase(), cantidad: 0, fuentes: [] };
      linea.fuentes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, unidad: a.unidad, cantidad: a.cantidad, factor: 1, calculada: a.cantidad, nota: "Malla convencional: va en el paquete de acero, en su unidad" });
      grupos.set(clave, linea);
      continue;
    }
    if (unidad(a.unidad) !== "kg") { pendientes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, motivo: `Está en ${a.unidad ?? "una unidad sin decir"}: el acero se consolida en kg.` }); continue; }
    const fy = d.match(/fy\s*=?\s*(\d+)\s*mpa/)?.[1];
    const clave = `acero|${fy ?? ""}`;
    const linea = grupos.get(clave) ?? { descripcion: `Suministro de acero de refuerzo${fy ? ` fy = ${fy} MPa` : " (grado sin indicar)"}`, unidad: "KG", cantidad: 0, fuentes: [] };
    linea.fuentes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, unidad: a.unidad, cantidad: a.cantidad, factor: 1, calculada: a.cantidad, nota: fy ? "Ya está en kg" : "Ya está en kg · el grado no aparece: confirmar" });
    grupos.set(clave, linea);
  }
  const lineas = [...grupos.values()].map((l) => ({ ...l, cantidad: Math.ceil(l.fuentes.reduce((s, f) => s + f.calculada, 0) - 1e-9) }));
  lineas.sort((a, b) => Number(/malla/i.test(a.descripcion)) - Number(/malla/i.test(b.descripcion)));
  return { tipo: "acero", lineas, pendientes };
}

function mamposteria(acts: Act[]): Consolidacion {
  const grupos = new Map<string, LineaBimbau>();
  const pendientes: Consolidacion["pendientes"] = [];
  for (const a of acts) {
    if (a.cantidad === null) { pendientes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, motivo: "No tiene cantidad." }); continue; }
    const u = unidad(a.unidad);
    if (u === "und" || u === "un" || u === "u") {
      const linea = grupos.get(a.descripcion) ?? { descripcion: a.descripcion, unidad: "UND", cantidad: 0, fuentes: [] };
      linea.fuentes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, unidad: a.unidad, cantidad: a.cantidad, factor: 1, calculada: a.cantidad, nota: "Ya está en unidades" });
      grupos.set(a.descripcion, linea); continue;
    }
    // Dimensiones «10x20x40» (cm) y junta «junta 1 cm»: unidades por m² = 1 / ((largo + junta)(alto + junta)).
    const dims = norm(a.descripcion).match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/);
    const junta = norm(a.descripcion).match(/junta\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(cm|mm)?/);
    if (u !== "m2" || !dims || !junta) { pendientes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, motivo: "Para pasar de m² a unidades hacen falta las dimensiones del bloque y la junta." }); continue; }
    // Ordenadas: espesor < alto < largo (un bloque «10x20x40» es de 10 de espesor, 20 de alto y 40 de largo).
    const [, alto, largo] = [n(dims[1]), n(dims[2]), n(dims[3])].sort((p, q) => p - q).map((v) => v / 100);
    const j = n(junta[1]) / (junta[2] === "mm" ? 1000 : 100);
    const factor = 1 / ((largo + j) * (alto + j));
    const clave = dims[0];
    const linea = grupos.get(clave) ?? { descripcion: `Suministro de bloque ${dims[0]} cm`, unidad: "UND", cantidad: 0, fuentes: [] };
    linea.fuentes.push({ actividadId: a.id, codigo: a.codigo, descripcion: a.descripcion, unidad: a.unidad, cantidad: a.cantidad, factor, calculada: a.cantidad * factor, nota: `${factor.toFixed(2)} unidades por m² (bloque ${dims[0]}, junta ${junta[1]} ${junta[2] ?? "cm"})` });
    grupos.set(clave, linea);
  }
  return { tipo: "mamposteria", lineas: [...grupos.values()].map((l) => ({ ...l, cantidad: Math.ceil(l.fuentes.reduce((s, f) => s + f.calculada, 0) - 1e-9) })), pendientes };
}

/** null si el paquete no es de los que se consolidan. */
export function consolidar(nombrePaquete: string, tipoPaquete: string, actividades: Act[]): Consolidacion | null {
  if (tipoPaquete !== "suministro") return null;
  const tipo = tipoConsolidable(nombrePaquete);
  if (!tipo) return null;
  const acts = [...actividades].sort((a, b) => a.orden - b.orden);
  return tipo === "concreto" ? concreto(acts) : tipo === "acero" ? acero(acts) : mamposteria(acts);
}

/** Las líneas que van al BIMBAU: las consolidadas y, después, las pendientes transcritas tal cual. */
export function lineasDelBimbau(c: Consolidacion, actividades: Act[]): LineaBimbau[] {
  const transcritas = c.pendientes.map((p) => {
    const a = actividades.find((x) => x.id === p.actividadId)!;
    return { descripcion: a.descripcion, unidad: a.unidad ?? "", cantidad: a.cantidad ?? 0, fuentes: [], transcrita: true, codigo: a.codigo };
  });
  return [...c.lineas, ...transcritas];
}
