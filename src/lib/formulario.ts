// Lee el formulario de cantidades del cliente y lo deja como Actividades, línea por línea.
//
// Regla del skill de Jhon que se respeta aquí: el cliente pide cada precio exactamente como está en su
// formulario. Nada se fusiona, renumera ni redacta de nuevo. Lo que no tiene unidad ni cantidad es un
// capítulo; lo demás es una actividad, con su código, descripción, unidad y cantidad tal como vienen.

import ExcelJS from "exceljs";
import { db } from "./db";
import { agentmail } from "./agentmail";

type Columnas = { fila: number; item: number | null; desc: number; unidad: number; cantidad: number };

const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function texto(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return String(v.result ?? "");
    if ("text" in v) return String((v as { text: string }).text);
  }
  return String(v);
}

function numero(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v && typeof v.result === "number") return v.result;
  const s = texto(v).replace(/\s/g, "");
  if (!s) return null;
  // 1.234,56 (es-CO) o 1,234.56 o 1234.56
  const limpio = /,\d{1,3}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** La fila de encabezados: la primera que nombra descripción, unidad y cantidad. */
function encontrarColumnas(hoja: ExcelJS.Worksheet): Columnas | null {
  for (let f = 1; f <= Math.min(hoja.rowCount, 40); f++) {
    const fila = hoja.getRow(f);
    let item: number | null = null, desc = 0, unidad = 0, cantidad = 0;
    fila.eachCell((c, col) => {
      const t = norm(texto(c.value));
      if (!t) return;
      if (!item && /^(item|ítem|codigo|cod\.?|no\.?)$/.test(t)) item = col;
      else if (!desc && /descripci|actividad|concepto/.test(t)) desc = col;
      else if (!unidad && /^(unidad|und\.?|un\.?|um)$/.test(t)) unidad = col;
      else if (!cantidad && /^cant/.test(t)) cantidad = col;
    });
    if (desc && unidad && cantidad) return { fila: f, item, desc, unidad, cantidad };
  }
  return null;
}

export type LecturaFormulario = { hojas: string[]; actividades: number; capitulos: number; omitidas: string[] };

/** Descarga el formulario de la oportunidad desde AgentMail y guarda sus actividades (reemplaza las anteriores). */
export async function leerFormulario(oportunidadId: string): Promise<LecturaFormulario> {
  const doc = await db.documento.findFirst({ where: { oportunidadId, tipo: "formulario" }, orderBy: { createdAt: "desc" } });
  if (!doc?.url?.startsWith("agentmail:")) throw new Error("Esta oportunidad no tiene un formulario de cantidades en Excel.");
  const [mid, aid] = doc.url.slice("agentmail:".length).split("|");
  const { download_url } = await agentmail.adjunto(mid, aid);
  if (!download_url) throw new Error("AgentMail no entregó el enlace de descarga del formulario.");
  const bytes = await (await fetch(download_url)).arrayBuffer();

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes);

  const filas: { hoja: string; fila: number; orden: number; codigo: string | null; descripcion: string; unidad: string | null; cantidad: number | null; esCapitulo: boolean; capitulo: string | null }[] = [];
  const hojas: string[] = [], omitidas: string[] = [];
  let orden = 0;

  for (const hoja of libro.worksheets) {
    if (hoja.state !== "visible") continue;
    const cols = encontrarColumnas(hoja);
    if (!cols) { omitidas.push(hoja.name); continue; }
    hojas.push(hoja.name);
    let capitulo: string | null = null;
    for (let f = cols.fila + 1; f <= hoja.rowCount; f++) {
      const r = hoja.getRow(f);
      const descripcion = texto(r.getCell(cols.desc).value).trim();
      if (!descripcion) continue;
      const codigo = cols.item ? texto(r.getCell(cols.item).value).trim() || null : null;
      const unidad = texto(r.getCell(cols.unidad).value).trim() || null;
      const cantidad = numero(r.getCell(cols.cantidad).value);
      const esCapitulo = !unidad && (cantidad === null || cantidad === 0);
      if (esCapitulo) capitulo = codigo ? `${codigo} ${descripcion}` : descripcion;
      filas.push({ hoja: hoja.name, fila: f, orden: orden++, codigo, descripcion, unidad, cantidad, esCapitulo, capitulo: esCapitulo ? null : capitulo });
    }
  }
  if (!filas.some((f) => !f.esCapitulo)) throw new Error("No encontré actividades en el formulario: revisa que tenga columnas de descripción, unidad y cantidad.");

  await db.$transaction([
    db.paquete.deleteMany({ where: { oportunidadId } }),
    db.actividad.deleteMany({ where: { oportunidadId } }),
    db.actividad.createMany({ data: filas.map((f) => ({ ...f, oportunidadId })) }),
  ]);
  return { hojas, actividades: filas.filter((f) => !f.esCapitulo).length, capitulos: filas.filter((f) => f.esCapitulo).length, omitidas };
}
