// Prueba de punta a punta, segunda parte: proveedores, invitaciones, respuestas, recordatorio y cuadro.
// Corre después de scripts/e2e.ts (necesita la invitación de Altavista con los paquetes confirmados).
//
//   prueba-prov-a-cc@agentmail.to   devuelve el BIMBAU diligenciado
//   prueba-prov-b-cc@agentmail.to   cotiza en el texto del correo, sin adjunto
//   prueba-tercero-cc@agentmail.to  no contesta, recibe el recordatorio y declina
//
//   npx tsx scripts/e2e-proveedores.ts

import "./_env";
import ExcelJS from "exceljs";
import { db } from "../src/lib/db";
import { revisarBuzon } from "../src/lib/buzon";
import { sugerirProveedores } from "../src/lib/proveedores";
import { aprobarYEnviar, enviarRecordatorios, cuadroComparativo } from "../src/lib/invitaciones";
import type { MensajeAM } from "../src/lib/agentmail";

const K = process.env.AGENTMAIL_API_KEY!;
const API = "https://api.agentmail.to/v0";
const AGENTE = process.env.AGENTMAIL_INBOX!;
const PROV = [
  { correo: "prueba-prov-a-cc@agentmail.to", nombre: "Metálicas Prueba A S.A.S." },
  { correo: "prueba-prov-b-cc@agentmail.to", nombre: "Montajes Prueba B S.A.S." },
  { correo: "prueba-tercero-cc@agentmail.to", nombre: "Estructuras Prueba C S.A.S." },
];

const am = async <T>(ruta: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(`${API}${ruta}`, { ...init, headers: { Authorization: `Bearer ${K}`, "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`${ruta} → ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
};
const bandeja = (b: string) => am<{ messages: MensajeAM[] }>(`/inboxes/${encodeURIComponent(b)}/messages?limit=30`).then((x) => x.messages);
const leer = (b: string, id: string) => am<MensajeAM>(`/inboxes/${encodeURIComponent(b)}/messages/${encodeURIComponent(id)}`);
const responder = (b: string, id: string, cuerpo: object) => am<{ message_id: string }>(`/inboxes/${encodeURIComponent(b)}/messages/${encodeURIComponent(id)}/reply`, { method: "POST", body: JSON.stringify(cuerpo) });
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function esperarEn(b: string, pred: (m: MensajeAM) => boolean, seg = 90) {
  for (let i = 0; i < seg / 3; i++) { const m = (await bandeja(b)).find(pred); if (m) return m; await esperar(3000); }
  return null;
}

let fallas = 0;
const check = (ok: boolean, que: string, det = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${que}${det ? ` · ${det}` : ""}`); if (!ok) fallas++; };

async function main() {
  const inicio = new Date();
  console.log(`\n═══ Proveedores, invitaciones y cuadro · ${inicio.toISOString().slice(11, 19)} ═══\n`);

  const opp = await db.oportunidad.findFirstOrThrow({ where: { origen: "invitacion", estado: "en_cotizacion" }, include: { paquetes: { include: { lineas: true } } } });
  const paquete = opp.paquetes.filter((p) => p.tipo === "servicio").sort((a, b) => b.lineas.length - a.lineas.length)[0] ?? opp.paquetes[0];
  console.log(`Paquete de prueba: «${paquete.nombre}» (${paquete.lineas.length} ítems) de ${opp.codigo}\n`);

  // Limpieza: invitaciones previas de este paquete y proveedores de prueba.
  await db.invitacion.deleteMany({ where: { paqueteId: paquete.id } });
  await db.proveedor.deleteMany({ where: { correo: { in: PROV.map((p) => p.correo) } } });
  for (const p of PROV) await db.proveedor.create({ data: { nombre: p.nombre, correo: p.correo, ciudad: "Medellín", actividades: [paquete.nombre], fuente: "base" } });

  // 1 · El agente propone a quién invitar
  console.log("1 · El agente elige proveedores");
  const s = await sugerirProveedores(paquete.id);
  console.log(`   ${JSON.stringify(s)}`);
  check(s.base === 3, "Encontró los 3 proveedores de la base que cotizan ese paquete");
  const borradores = await db.invitacion.findMany({ where: { paqueteId: paquete.id }, include: { proveedor: true } });
  check(borradores.every((i) => i.estado === "borrador"), "Todas quedaron en borrador: nada sale sin aprobación", `${borradores.length} invitaciones`);
  const delSecop = borradores.filter((i) => i.proveedor.fuente === "secop");
  check(s.secop === 0 || delSecop.every((i) => i.proveedor.verificadoEn), "Los del SECOP están verificados (sanciones y contratos)", delSecop.map((i) => `${i.proveedor.nombre}: ${i.proveedor.contratosPublicos} contratos, ${i.proveedor.sancionado ? "CON" : "sin"} sanciones`).join(" | "));

  // 2 · Licitaciones aprueba y el agente envía
  console.log("\n2 · Aprobación y envío");
  const env = await aprobarYEnviar(paquete.id, "Prueba");
  console.log(`   ${JSON.stringify(env)}`);
  check(env.enviadas === 3, "Envió las 3 invitaciones a los buzones de prueba");
  check(delSecop.length === 0 || env.bloqueadas.length === delSecop.length, "Los proveedores reales del SECOP NO recibieron nada (modo prueba)", env.bloqueadas.join(" | "));
  const salientesReales = await db.correo.count({ where: { direccion: "saliente", recibidoEn: { gte: inicio }, NOT: { para: { endsWith: "agentmail.to" } } } });
  check(salientesReales === 0, "Ningún correo salió a un dominio real");

  const recibidas = await Promise.all(PROV.map((p) => esperarEn(p.correo, (m) => m.from.includes(AGENTE) && (m.subject ?? "").includes(paquete.nombre))));
  check(recibidas.every(Boolean), "Los 3 proveedores recibieron la invitación");
  const invA = recibidas[0] ? await leer(PROV[0].correo, recibidas[0].message_id) : null;
  check(!!invA?.attachments?.some((a) => /Bimbau_/.test(a.filename ?? "")), "La invitación trae el BIMBAU adjunto", invA?.attachments?.map((a) => a.filename).join(", "));

  // 3 · A devuelve el BIMBAU diligenciado; B cotiza en el texto
  console.log("\n3 · Respuestas de los proveedores");
  let esperadoA = 0;
  if (invA) {
    const adj = invA.attachments!.find((a) => /Bimbau_/.test(a.filename ?? ""))!;
    const { download_url } = await am<{ download_url: string }>(`/inboxes/${encodeURIComponent(PROV[0].correo)}/messages/${encodeURIComponent(invA.message_id)}/attachments/${adj.attachment_id}`);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await (await fetch(download_url)).arrayBuffer());
    const h = libro.getWorksheet("Items_Ofertar")!;
    for (let f = 12; f <= h.rowCount; f++) {
      const item = h.getCell(f, 2).value, cant = h.getCell(f, 7).value;
      if (typeof item === "number" && typeof cant === "number") { const unit = 85_000 + item * 1_000; h.getCell(f, 9).value = unit; esperadoA += Math.round(cant * unit); }
    }
    const buf = Buffer.from(await libro.xlsx.writeBuffer());
    await responder(PROV[0].correo, invA.message_id, {
      text: "Buenas tardes. Adjuntamos el formulario diligenciado. Plazo de ejecución: 90 días. Validez de la oferta: 30 días.\n\nMetálicas Prueba A",
      attachments: [{ filename: adj.filename, content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: buf.toString("base64") }],
    });
  }
  if (recibidas[1]) await responder(PROV[1].correo, recibidas[1].message_id, { text: "Buen día. Nuestra oferta para este paquete es por un valor total de $9.850.000.000 antes de IVA, con plazo de 120 días y validez de 45 días. Quedamos atentos.\n\nMontajes Prueba B" });

  await esperarEn(AGENTE, (m) => m.from.includes(PROV[0].correo) && new Date(m.timestamp) > inicio);
  await esperarEn(AGENTE, (m) => m.from.includes(PROV[1].correo) && new Date(m.timestamp) > inicio);
  const r1 = await revisarBuzon();
  console.log(`   ${JSON.stringify(r1)}`);
  check(r1.proveedores === 2, "El buzón reconoció las 2 respuestas como de proveedores");
  const cotA = await db.cotizacion.findFirst({ where: { invitacion: { paqueteId: paquete.id, proveedor: { correo: PROV[0].correo } } } });
  check(!!cotA && Number(cotA.valorTotal) === esperadoA, "Total de A calculado por código desde el BIMBAU", `${cotA ? Number(cotA.valorTotal).toLocaleString("es-CO") : "—"} vs esperado ${esperadoA.toLocaleString("es-CO")}`);
  check(cotA?.plazoDias === 90 && cotA?.validezDias === 30, "Tomó plazo y validez de A", `${cotA?.plazoDias} días · ${cotA?.validezDias} días`);
  const cotB = await db.cotizacion.findFirst({ where: { invitacion: { paqueteId: paquete.id, proveedor: { correo: PROV[1].correo } } } });
  check(Number(cotB?.valorTotal) === 9_850_000_000, "Tomó el total que B escribió en el correo", cotB ? Number(cotB.valorTotal).toLocaleString("es-CO") : "—");

  // 4 · C no contesta: recordatorio, y declina
  console.log("\n4 · Recordatorio y declinación");
  const rec = await enviarRecordatorios(0);
  check(rec.enviados === 1, "Mandó un solo recordatorio: al que no ha contestado", JSON.stringify(rec));
  const recordatorio = await esperarEn(PROV[2].correo, (m) => m.from.includes(AGENTE) && /record/i.test((m.preview ?? "") + (m.text ?? "")));
  check(!!recordatorio, "C recibió el recordatorio en el mismo hilo");
  if (recordatorio) await responder(PROV[2].correo, recordatorio.message_id, { text: "Gracias por la invitación. En esta ocasión no vamos a cotizar por carga de trabajo.\n\nEstructuras Prueba C" });
  await esperarEn(AGENTE, (m) => m.from.includes(PROV[2].correo) && new Date(m.timestamp) > inicio);
  const r2 = await revisarBuzon();
  const invC = await db.invitacion.findFirst({ where: { paqueteId: paquete.id, proveedor: { correo: PROV[2].correo } } });
  check(invC?.estado === "declino", "Registró que C declinó", `${invC?.estado} · ${JSON.stringify(r2)}`);

  // 5 · Cuadro comparativo
  console.log("\n5 · Cuadro comparativo");
  const c = await cuadroComparativo(paquete.id);
  check(c.proveedores.length === 2, "El cuadro tiene a los 2 que cotizaron");
  check(c.proveedores[0].total! <= c.proveedores[1].total!, "Ordenado del menor al mayor total", c.proveedores.map((p) => `${p.nombre}: ${p.total?.toLocaleString("es-CO")}`).join(" | "));
  const a = c.proveedores.find((p) => p.nombre.includes("Prueba A"));
  check(a?.itemsCotizados === c.totalItems, "A cotizó todos los ítems del paquete", `${a?.itemsCotizados}/${c.totalItems}`);
  const b = c.proveedores.find((p) => p.nombre.includes("Prueba B"));
  check(b?.itemsCotizados === 0, "B no trae precios por ítem: el cuadro lo muestra (solo total)");

  console.log(`\n═══ ${fallas === 0 ? "TODO BIEN" : `${fallas} FALLA(S)`} ═══\n`);
}

main().catch((e) => { console.error(e); fallas++; }).finally(async () => { await db.$disconnect(); process.exit(fallas ? 1 : 0); });
