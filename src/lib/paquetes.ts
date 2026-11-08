// Paquetes de cotización, con las reglas del skill de Jhon (separar-paquetes-cotizacion):
//   1. Cada actividad queda en al menos un paquete. Ninguna sin asignar.
//   2. Una actividad SÍ puede estar en varios paquetes (se cotiza con los dos tipos de proveedor).
//   3. Se conserva la estructura del cliente: mismos códigos, descripciones, unidades y cantidades.
//   4. Tipos: Suministro (solo material), Servicio (suministro e instalación, subcontratos especializados),
//      Mano de obra (solo ejecución, con los materiales puestos por la obra).
//
// El agente propone la agrupación; el código verifica la regla 1 y arma los archivos; Jhon confirma.

import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { generarBimbau } from "./bimbau";
import { consolidar, lineasDelBimbau, type Consolidacion } from "./consolidar";
import { pedirEstructurado } from "./claude";
import { leerFormulario } from "./formulario";
import type { TipoPaquete } from "@prisma/client";

type Propuesta = { paquetes: { nombre: string; tipo: TipoPaquete; porque: string; actividades: string[] }[] };

const HERRAMIENTA = {
  name: "proponer_paquetes",
  description: "Propone los paquetes de cotización del formulario de cantidades.",
  input_schema: {
    type: "object",
    required: ["paquetes"],
    properties: {
      paquetes: {
        type: "array",
        items: {
          type: "object",
          required: ["nombre", "tipo", "porque", "actividades"],
          properties: {
            nombre: { type: "string", description: "Nombre del paquete como lo diría compras: «Estructura metálica», «Concreto premezclado», «Red contra incendio»." },
            tipo: { type: "string", enum: ["suministro", "servicio", "mano_de_obra"] },
            porque: { type: "string", description: "Qué tipo de proveedor cotiza este paquete, en una frase." },
            actividades: { type: "array", items: { type: "string" }, description: "Los id de las actividades (A1, A2…)." },
          },
        },
      },
    },
  },
};

const SISTEMA = `Eres el analista de presupuestos de Conconcreto que separa el formulario de cantidades de un cliente en paquetes para pedir cotización a proveedores.

Reglas, sin excepción:
1. Agrupa por QUÉ PROVEEDOR puede cotizar cada actividad. Las actividades de un paquete pueden estar en capítulos distintos.
2. TODA actividad va en al menos un paquete. Si no encaja en ninguno, crea un paquete propio para buscar un proveedor específico.
3. Una actividad puede ir en dos paquetes si la cotizan dos tipos de proveedor (ej. el concreto de una losa va en «Concreto premezclado» como suministro y en la mano de obra de la estructura).
4. Tipos: «suministro» = solo el material (concreto premezclado, acero de refuerzo, agregados, prefabricados); «servicio» = suministro e instalación o subcontrato especializado (estructura metálica, cubierta, redes, piso industrial); «mano_de_obra» = solo la ejecución con los materiales puestos por la obra (excavación, rellenos, mampostería).
5. El acero de refuerzo y la malla electrosoldada convencional los cotizan los mismos proveedores: van en «Acero de refuerzo».
6. Prefiere paquetes que un proveedor real cotice completos. No hagas un paquete por actividad, ni un paquete gigante.
7. No cambies nada del cliente: solo devuelves ids.
Entrega la propuesta con la herramienta proponer_paquetes.`;

export type ResultadoPropuesta = { paquetes: number; actividades: number; compartidas: number; sinAsignar: number };

export async function proponerPaquetes(oportunidadId: string): Promise<ResultadoPropuesta> {
  if (!(await db.actividad.count({ where: { oportunidadId } }))) await leerFormulario(oportunidadId);
  const todas = await db.actividad.findMany({ where: { oportunidadId }, orderBy: { orden: "asc" } });
  const actividades = todas.filter((a) => !a.esCapitulo);
  const idCorto = new Map(actividades.map((a, i) => [`A${i + 1}`, a.id]));
  const lista = (xs: typeof actividades) => xs.map((a) => `${[...idCorto].find(([, v]) => v === a.id)![0]} | ${a.capitulo ?? ""} | ${a.codigo ?? ""} | ${a.descripcion} | ${a.unidad ?? ""} | ${a.cantidad ?? ""}`).join("\n");

  const o = await db.oportunidad.findUniqueOrThrow({ where: { id: oportunidadId } });
  let propuesta = await pedirEstructurado<Propuesta>({
    sistema: SISTEMA, herramienta: HERRAMIENTA, maxTokens: 8000,
    usuario: `Proyecto: ${o.titulo} · ${o.entidad}\n\nActividades (id | capítulo | código del cliente | descripción | unidad | cantidad):\n${lista(actividades)}`,
  });

  // Regla 1, verificada por código: lo que quedó sin asignar vuelve al agente una vez.
  const asignadas = () => new Set(propuesta.paquetes.flatMap((p) => p.actividades).filter((x) => idCorto.has(x)));
  let faltan = actividades.filter((a) => ![...asignadas()].some((x) => idCorto.get(x) === a.id));
  if (faltan.length) {
    const extra = await pedirEstructurado<Propuesta>({
      sistema: SISTEMA, herramienta: HERRAMIENTA,
      usuario: `Ya propusiste estos paquetes: ${propuesta.paquetes.map((p) => `«${p.nombre}» (${p.tipo})`).join(", ")}.\nEstas actividades quedaron sin paquete. Asígnalas a uno de esos paquetes (usa el mismo nombre exacto) o crea uno nuevo:\n${lista(faltan)}`,
    });
    for (const p of extra.paquetes) {
      const existente = propuesta.paquetes.find((x) => x.nombre === p.nombre);
      if (existente) existente.actividades.push(...p.actividades);
      else propuesta.paquetes.push(p);
    }
    faltan = actividades.filter((a) => ![...asignadas()].some((x) => idCorto.get(x) === a.id));
  }
  // Si aun así sobra algo, no se pierde en silencio: queda a la vista para que Jhon lo ubique.
  if (faltan.length) propuesta = { paquetes: [...propuesta.paquetes, { nombre: "Por asignar", tipo: "servicio", porque: "El agente no supo a qué proveedor corresponden: hay que ubicarlas a mano.", actividades: faltan.map((a) => [...idCorto].find(([, v]) => v === a.id)![0]) }] };

  // Nombres únicos y sin paquetes vacíos.
  const vistos = new Set<string>();
  const paquetes = propuesta.paquetes
    .map((p) => ({ ...p, ids: [...new Set(p.actividades.map((x) => idCorto.get(x)).filter((x): x is string => !!x))] }))
    .filter((p) => p.ids.length && !vistos.has(p.nombre) && vistos.add(p.nombre));

  await db.$transaction(async (tx) => {
    await tx.paquete.deleteMany({ where: { oportunidadId } });
    await tx.archivo.deleteMany({ where: { oportunidadId } });
    for (const p of paquetes) {
      await tx.paquete.create({
        data: { oportunidadId, nombre: p.nombre, tipo: p.tipo, porque: p.porque, actividades: p.ids.length, lineas: { create: p.ids.map((actividadId) => ({ actividadId })) } },
      });
    }
  }, { timeout: 30_000 });

  const veces = new Map<string, number>();
  for (const p of paquetes) for (const id of p.ids) veces.set(id, (veces.get(id) ?? 0) + 1);
  const r = { paquetes: paquetes.length, actividades: actividades.length, compartidas: [...veces.values()].filter((v) => v > 1).length, sinAsignar: faltan.length };
  await db.evento.create({
    data: {
      oportunidadId, actor: "agente", tipo: "paquetes.propuestos",
      descripcion: `Leyó ${r.actividades} actividades del formulario y propuso ${r.paquetes} paquetes${r.compartidas ? ` (${r.compartidas} actividades en dos paquetes)` : ""}${r.sinAsignar ? ` · ${r.sinAsignar} por asignar a mano` : " · ninguna sin asignar"}`,
      datos: r,
    },
  });
  return r;
}

/* ── Confirmar: los BIMBAU y el control ──────────────────────────────── */

const VERDE = "FF07582B";

/** Lo que sale en el BIMBAU de un paquete: sus actividades tal cual, o las líneas consolidadas si es un suministro. */
export function lineasDePaquete(p: { nombre: string; tipo: string }, actividades: { id: string; codigo: string | null; descripcion: string; unidad: string | null; cantidad: number | null; orden: number; capitulo: string | null }[]) {
  const ordenadas = [...actividades].sort((a, b) => a.orden - b.orden);
  const c = consolidar(p.nombre, p.tipo, ordenadas);
  if (!c) return { consolidacion: null, lineas: ordenadas.map((a) => ({ capitulo: a.capitulo, codigo: a.codigo, descripcion: a.descripcion, unidad: a.unidad, cantidad: a.cantidad })) };
  const lineas = lineasDelBimbau(c, ordenadas).map((l) => ({ capitulo: l.transcrita ? "Por confirmar (no se pudo consolidar)" : p.nombre, codigo: l.transcrita ? l.codigo ?? null : null, descripcion: l.descripcion, unidad: l.unidad, cantidad: l.cantidad }));
  return { consolidacion: c, lineas };
}

export async function confirmarPaquetes(oportunidadId: string, quien: string) {
  const o = await db.oportunidad.findUniqueOrThrow({ where: { id: oportunidadId } });
  const paquetes = await db.paquete.findMany({ where: { oportunidadId }, include: { lineas: { include: { actividad: true } } }, orderBy: [{ tipo: "asc" }, { nombre: "asc" }] });
  if (!paquetes.length) throw new Error("No hay paquetes propuestos.");
  if (paquetes.some((p) => p.nombre === "Por asignar" && p.lineas.length)) throw new Error("Quedan actividades por asignar: ubícalas antes de confirmar.");

  const archivos: { nombre: string; tipo: string; paqueteId: string | null; contenido: Buffer }[] = [];
  const consolidados: { paquete: string; c: Consolidacion }[] = [];
  const actualizaciones = [];
  for (const p of paquetes) {
    const { consolidacion, lineas } = lineasDePaquete(p, p.lineas.map((l) => l.actividad));
    if (consolidacion) consolidados.push({ paquete: p.nombre, c: consolidacion });
    actualizaciones.push(db.paquete.update({ where: { id: p.id }, data: { consolidado: consolidacion ? (consolidacion as object) : Prisma.DbNull } }));
    archivos.push({ nombre: `Bimbau_${p.nombre}.xlsx`, tipo: "bimbau", paqueteId: p.id, contenido: await generarBimbau(o.titulo, lineas) });
  }

  // El control: el formulario del cliente con la columna «Paquete», y una memoria de cálculo por consolidado.
  const todas = await db.actividad.findMany({ where: { oportunidadId }, orderBy: { orden: "asc" }, include: { paquetes: { include: { paquete: true } } } });
  const libro = new ExcelJS.Workbook();
  const encabezado = (h: ExcelJS.Worksheet) => h.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } }; });
  const h = libro.addWorksheet("Control", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  h.columns = [{ header: "Hoja", width: 14 }, { header: "Código", width: 10 }, { header: "Descripción", width: 64 }, { header: "Unidad", width: 9 }, { header: "Cantidad", width: 13 }, { header: "Paquete", width: 48 }];
  encabezado(h);
  for (const a of todas) {
    const r = h.addRow([a.hoja, a.codigo, a.descripcion, a.unidad, a.cantidad, a.esCapitulo ? "Capítulo" : a.paquetes.map((x) => x.paquete.nombre).join(" / ")]);
    if (a.esCapitulo) r.font = { bold: true };
    r.getCell(5).numFmt = "#,##0.00";
  }
  for (const { paquete, c } of consolidados) {
    const m = libro.addWorksheet(`Calculo_${paquete}`.slice(0, 31), { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
    m.columns = [{ header: "Línea BIMBAU", width: 40 }, { header: "Código cliente", width: 13 }, { header: "Descripción cliente", width: 52 }, { header: "Unidad", width: 9 }, { header: "Cantidad cliente", width: 15 }, { header: "Factor", width: 10 }, { header: "Cantidad calculada", width: 17 }, { header: "Nota", width: 48 }];
    encabezado(m);
    for (const l of c.lineas) {
      for (const f of l.fuentes) m.addRow([l.descripcion, f.codigo, f.descripcion, f.unidad, f.cantidad, f.factor, f.calculada, f.nota]).getCell(7).numFmt = "#,##0.00";
      const t = m.addRow([`TOTAL ${l.descripcion} (redondeado hacia arriba)`, null, null, l.unidad, null, null, l.cantidad, null]); t.font = { bold: true };
    }
    for (const pnd of c.pendientes) m.addRow(["PENDIENTE", pnd.codigo, pnd.descripcion, null, null, null, null, pnd.motivo]).font = { color: { argb: "FFC2410C" } };
  }
  archivos.push({ nombre: "Control_Asignacion_Paquetes.xlsx", tipo: "control", paqueteId: null, contenido: Buffer.from(await libro.xlsx.writeBuffer()) });

  await db.$transaction([
    ...actualizaciones,
    db.archivo.deleteMany({ where: { oportunidadId } }),
    ...archivos.map((a) => db.archivo.create({ data: { oportunidadId, ...a, contenido: new Uint8Array(a.contenido) } })),
    db.paquete.deleteMany({ where: { oportunidadId, nombre: "Por asignar" } }),
    db.paquete.updateMany({ where: { oportunidadId }, data: { estado: "confirmado" } }),
    db.oportunidad.update({ where: { id: oportunidadId }, data: { estado: "en_cotizacion" } }),
    db.evento.create({ data: { oportunidadId, actor: "persona", tipo: "paquetes.confirmados", descripcion: `${quien} confirmó ${paquetes.length} paquetes` } }),
    db.evento.create({
      data: {
        oportunidadId, actor: "agente", tipo: "paquetes.archivos",
        descripcion: `Armó ${paquetes.length} formularios BIMBAU sobre la plantilla oficial y el control de asignación${consolidados.length ? ` · consolidó ${consolidados.map((x) => `«${x.paquete}»`).join(", ")}${consolidados.some((x) => x.c.pendientes.length) ? ` (${consolidados.reduce((s, x) => s + x.c.pendientes.length, 0)} actividades pendientes de confirmar)` : ""}` : ""}`,
      },
    }),
  ]);
  return { archivos: archivos.length, consolidados: consolidados.length };
}

/** Mover una actividad de un paquete a otro antes de confirmar. Si ya estaba en el destino, solo sale del origen. */
export async function moverActividad(actividadId: string, desdeId: string, haciaId: string, quien: string) {
  if (desdeId === haciaId) throw new Error("La actividad ya está en ese paquete.");
  const [desde, hacia, act] = await Promise.all([
    db.paquete.findUniqueOrThrow({ where: { id: desdeId } }),
    db.paquete.findUniqueOrThrow({ where: { id: haciaId } }),
    db.actividad.findUniqueOrThrow({ where: { id: actividadId } }),
  ]);
  if (desde.estado === "confirmado" || hacia.estado === "confirmado") throw new Error("Los paquetes ya están confirmados.");
  if (desde.oportunidadId !== hacia.oportunidadId) throw new Error("Los paquetes son de oportunidades distintas.");
  await db.$transaction(async (tx) => {
    await tx.paqueteActividad.delete({ where: { paqueteId_actividadId: { paqueteId: desdeId, actividadId } } });
    await tx.paqueteActividad.upsert({ where: { paqueteId_actividadId: { paqueteId: haciaId, actividadId } }, update: {}, create: { paqueteId: haciaId, actividadId } });
    for (const id of [desdeId, haciaId]) await tx.paquete.update({ where: { id }, data: { actividades: await tx.paqueteActividad.count({ where: { paqueteId: id } }) } });
    // Un paquete que se queda vacío no tiene a quién pedirle cotización.
    await tx.paquete.deleteMany({ where: { id: desdeId, lineas: { none: {} } } });
    await tx.evento.create({ data: { oportunidadId: desde.oportunidadId, actor: "persona", tipo: "paquetes.movio", descripcion: `${quien} movió «${act.codigo ?? ""} ${act.descripcion}» de «${desde.nombre}» a «${hacia.nombre}»` } });
  });
}
