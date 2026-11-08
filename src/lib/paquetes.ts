// Paquetes de cotización, con las reglas del skill de Jhon (separar-paquetes-cotizacion):
//   1. Cada actividad queda en al menos un paquete. Ninguna sin asignar.
//   2. Una actividad SÍ puede estar en varios paquetes (se cotiza con los dos tipos de proveedor).
//   3. Se conserva la estructura del cliente: mismos códigos, descripciones, unidades y cantidades.
//   4. Tipos: Suministro (solo material), Servicio (suministro e instalación, subcontratos especializados),
//      Mano de obra (solo ejecución, con los materiales puestos por la obra).
//
// El agente propone la agrupación; el código verifica la regla 1 y arma los archivos; Jhon confirma.

import ExcelJS from "exceljs";
import { db } from "./db";
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

const VERDE = "FF07582B", GRIS = "FFEEF2EE";

/** BIMBAU con las reglas del skill de Jhon: proyecto en D5, duración en D6, encabezados en la fila 11,
 *  ITEM consecutivo, código del cliente como texto, OMNICLASS = ITEM, cantidades a 2 decimales,
 *  capítulos «CAPÍTULO N - <nombre>» y VALOR TOTAL = valor unitario × cantidad.
 *  Es una reconstrucción del formato: cuando esté la plantilla oficial de Conconcreto, se usa esa. */
async function bimbau(proyecto: string, paquete: string, lineas: { capitulo: string | null; codigo: string | null; descripcion: string; unidad: string | null; cantidad: number | null }[]) {
  const libro = new ExcelJS.Workbook();
  const h = libro.addWorksheet("Items_Ofertar", { views: [{ showGridLines: false }] });
  h.getColumn(2).width = 7; h.getColumn(3).width = 16; h.getColumn(4).width = 70; h.getColumn(5).width = 11;
  h.getColumn(6).width = 9; h.getColumn(7).width = 13; h.getColumn(8).width = 12; h.getColumn(9).width = 16; h.getColumn(10).width = 18; h.getColumn(11).width = 16;
  h.getCell("B2").value = "CONCONCRETO · Formulario de cotización"; h.getCell("B2").font = { bold: true, size: 14, color: { argb: VERDE } };
  h.getCell("B3").value = `Paquete: ${paquete}`; h.getCell("B3").font = { bold: true };
  h.getCell("C5").value = "Proyecto"; h.getCell("D5").value = proyecto;
  h.getCell("C6").value = "Duración (días)"; h.getCell("D6").value = null;
  h.getCell("C8").value = "Diligencie el valor unitario. El valor total se calcula solo."; h.getCell("C8").font = { italic: true, color: { argb: "FF7B847E" } };

  const enc = ["ITEM", "CÓDIGO EMPRESA", "DESCRIPCIÓN", "OMNICLASS", "UNIDAD", "CANTIDAD", "SKU", "VALOR UNITARIO", "VALOR TOTAL", "PRESUPUESTO"];
  enc.forEach((t, i) => { const c = h.getCell(11, i + 2); c.value = t; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } }; c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; });

  let fila = 12, item = 0, n = 0, capituloActual: string | undefined;
  for (const l of lineas) {
    const cap = l.capitulo ?? "Sin capítulo";
    if (cap !== capituloActual) {
      capituloActual = cap; n++;
      const c = h.getCell(fila, 4); c.value = `CAPÍTULO ${n} - ${cap.replace(/^[\d.]+\s*/, "")}`; c.font = { bold: true };
      for (let col = 2; col <= 11; col++) h.getCell(fila, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
      fila++;
    }
    item++;
    h.getCell(fila, 2).value = item;
    h.getCell(fila, 3).value = l.codigo ?? String(item); h.getCell(fila, 3).numFmt = "@";
    h.getCell(fila, 4).value = l.descripcion; h.getCell(fila, 4).alignment = { wrapText: true, vertical: "top" };
    h.getCell(fila, 5).value = item;
    h.getCell(fila, 6).value = l.unidad;
    h.getCell(fila, 7).value = l.cantidad === null ? null : Math.round(l.cantidad * 100) / 100; h.getCell(fila, 7).numFmt = "#,##0.00";
    h.getCell(fila, 9).numFmt = "$ #,##0";
    h.getCell(fila, 10).value = { formula: `I${fila}*G${fila}` }; h.getCell(fila, 10).numFmt = "$ #,##0";
    fila++;
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}

export async function confirmarPaquetes(oportunidadId: string, quien: string) {
  const o = await db.oportunidad.findUniqueOrThrow({ where: { id: oportunidadId } });
  const paquetes = await db.paquete.findMany({ where: { oportunidadId }, include: { lineas: { include: { actividad: true } } }, orderBy: [{ tipo: "asc" }, { nombre: "asc" }] });
  if (!paquetes.length) throw new Error("No hay paquetes propuestos.");
  if (paquetes.some((p) => p.nombre === "Por asignar")) throw new Error("Quedan actividades por asignar: ubícalas antes de confirmar.");

  const archivos: { nombre: string; tipo: string; paqueteId: string | null; contenido: Buffer }[] = [];
  for (const p of paquetes) {
    const lineas = p.lineas.map((l) => l.actividad).sort((a, b) => a.orden - b.orden);
    archivos.push({ nombre: `Bimbau_${p.nombre}.xlsx`, tipo: "bimbau", paqueteId: p.id, contenido: await bimbau(o.titulo, p.nombre, lineas) });
  }

  // El control: el formulario del cliente, línea por línea, con la columna «Paquete».
  const todas = await db.actividad.findMany({ where: { oportunidadId }, orderBy: { orden: "asc" }, include: { paquetes: { include: { paquete: true } } } });
  const libro = new ExcelJS.Workbook();
  const h = libro.addWorksheet("Control", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  h.columns = [{ header: "Hoja", width: 14 }, { header: "Código", width: 10 }, { header: "Descripción", width: 64 }, { header: "Unidad", width: 9 }, { header: "Cantidad", width: 13 }, { header: "Paquete", width: 48 }];
  h.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } }; });
  for (const a of todas) {
    const r = h.addRow([a.hoja, a.codigo, a.descripcion, a.unidad, a.cantidad, a.esCapitulo ? "Capítulo" : a.paquetes.map((x) => x.paquete.nombre).join(" / ")]);
    if (a.esCapitulo) r.font = { bold: true };
    r.getCell(5).numFmt = "#,##0.00";
  }
  archivos.push({ nombre: "Control_Asignacion_Paquetes.xlsx", tipo: "control", paqueteId: null, contenido: Buffer.from(await libro.xlsx.writeBuffer()) });

  await db.$transaction([
    db.archivo.deleteMany({ where: { oportunidadId } }),
    ...archivos.map((a) => db.archivo.create({ data: { oportunidadId, ...a, contenido: new Uint8Array(a.contenido) } })),
    db.paquete.updateMany({ where: { oportunidadId }, data: { estado: "confirmado" } }),
    db.oportunidad.update({ where: { id: oportunidadId }, data: { estado: "en_cotizacion" } }),
    db.evento.create({ data: { oportunidadId, actor: "persona", tipo: "paquetes.confirmados", descripcion: `${quien} confirmó ${paquetes.length} paquetes` } }),
    db.evento.create({ data: { oportunidadId, actor: "agente", tipo: "paquetes.archivos", descripcion: `Armó ${paquetes.length} formularios BIMBAU y el control de asignación` } }),
  ]);
  return { archivos: archivos.length };
}
