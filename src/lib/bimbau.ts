// El formulario BIMBAU de un paquete, sobre la plantilla oficial de Conconcreto (plantillas/Bimbau_Plantilla.xlsx).
//
// Reglas del skill de Jhon (llenar_bimbau.ps1):
//   · Hoja Items_Ofertar: proyecto en D5, duración en D6, encabezados en la fila 11.
//   · Fila 12 = modelo de capítulo (B12:K12 combinadas), fila 13 = modelo de ítem. Se escribe desde la 12
//     copiando ese formato, y las hojas ocultas (Fecha, Puntaje) no se tocan.
//   · ITEM consecutivo; CÓDIGO EMPRESA = el del cliente o el ITEM; OMNICLASS = ITEM; CANTIDAD a 2 decimales;
//     SKU, VALOR UNITARIO y PRESUPUESTO vacíos; VALOR TOTAL = I × G.
// Si la plantilla no está, se genera un formato equivalente.

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

export type LineaFormulario = { capitulo: string | null; codigo: string | null; descripcion: string; unidad: string | null; cantidad: number | null };

const PLANTILLA = path.join(process.cwd(), "plantillas", "Bimbau_Plantilla.xlsx");
const COLS = 11; // B..K

const capituloLimpio = (c: string) => c.replace(/^[\d.]+\s*/, "");

export async function generarBimbau(proyecto: string, lineas: LineaFormulario[]): Promise<Buffer> {
  if (!fs.existsSync(PLANTILLA)) return generarSinPlantilla(proyecto, lineas);

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(PLANTILLA);
  const h = libro.getWorksheet("Items_Ofertar")!;
  h.getCell("D5").value = proyecto;

  // Los modelos de formato antes de pisarlos.
  const estilo = (fila: number) => Array.from({ length: COLS - 1 }, (_, i) => JSON.parse(JSON.stringify(h.getCell(fila, i + 2).style)) as Partial<ExcelJS.Style>);
  const estiloCap = estilo(12), estiloItem = estilo(13);
  const altoItem = h.getRow(13).height;
  try { h.unMergeCells("B12:K12"); } catch { /* ya estaba sin combinar */ }
  for (let f = 12; f <= Math.max(13, h.rowCount); f++) for (let c = 2; c <= COLS; c++) h.getCell(f, c).value = null;

  let fila = 12, item = 0, n = 0;
  let actual: string | undefined;
  for (const l of lineas) {
    const cap = l.capitulo ?? "Sin capítulo";
    if (cap !== actual) {
      actual = cap; n++;
      estiloCap.forEach((s, i) => (h.getCell(fila, i + 2).style = s));
      h.getCell(fila, 2).value = `CAPÍTULO ${n} - ${capituloLimpio(cap)}`;
      h.mergeCells(fila, 2, fila, COLS);
      fila++;
    }
    item++;
    estiloItem.forEach((s, i) => (h.getCell(fila, i + 2).style = s));
    if (altoItem) h.getRow(fila).height = altoItem;
    h.getCell(fila, 2).value = item;
    h.getCell(fila, 3).value = l.codigo || String(item); h.getCell(fila, 3).numFmt = "@";
    h.getCell(fila, 4).value = l.descripcion;
    h.getCell(fila, 5).value = String(item); h.getCell(fila, 5).numFmt = "@";
    h.getCell(fila, 6).value = l.unidad;
    h.getCell(fila, 7).value = l.cantidad === null ? null : Math.round(l.cantidad * 100) / 100;
    h.getCell(fila, 10).value = { formula: `I${fila}*$G${fila}` };
    fila++;
  }
  h.pageSetup.printArea = `B1:J${fila - 1}`; // sin «$»: exceljs los agrega
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** Formato equivalente, para cuando no está la plantilla oficial. */
async function generarSinPlantilla(proyecto: string, lineas: LineaFormulario[]) {
  const libro = new ExcelJS.Workbook();
  const h = libro.addWorksheet("Items_Ofertar", { views: [{ showGridLines: false }] });
  [7, 16, 70, 11, 9, 13, 12, 16, 18, 16].forEach((w, i) => (h.getColumn(i + 2).width = w));
  h.getCell("B2").value = "PRODUCTOS A LICITAR"; h.getCell("B2").font = { bold: true, size: 14 };
  h.getCell("B5").value = "NOMBRE DEL PROYECTO"; h.getCell("D5").value = proyecto;
  h.getCell("B6").value = "DURACIÓN DEL PROYECTO (DÍAS):";
  ["ITEM", "CODIGO EMPRESA", "DESCRIPCION", "OMNICLASS", "UNIDAD", "CANTIDAD", "SKU", "VALOR UNITARIO", "VALOR TOTAL", "PRESUPUESTO"].forEach((t, i) => {
    const c = h.getCell(11, i + 2); c.value = t; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF07582B" } };
  });
  let fila = 12, item = 0, n = 0; let actual: string | undefined;
  for (const l of lineas) {
    const cap = l.capitulo ?? "Sin capítulo";
    if (cap !== actual) { actual = cap; n++; h.getCell(fila, 2).value = `CAPÍTULO ${n} - ${capituloLimpio(cap)}`; h.getCell(fila, 2).font = { bold: true }; h.mergeCells(fila, 2, fila, COLS); fila++; }
    item++;
    h.getCell(fila, 2).value = item; h.getCell(fila, 3).value = l.codigo || String(item); h.getCell(fila, 4).value = l.descripcion; h.getCell(fila, 5).value = String(item);
    h.getCell(fila, 6).value = l.unidad; h.getCell(fila, 7).value = l.cantidad === null ? null : Math.round(l.cantidad * 100) / 100;
    h.getCell(fila, 10).value = { formula: `I${fila}*$G${fila}` };
    fila++;
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}
