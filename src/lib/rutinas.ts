// Lo que corre solo. Cada rutina es una función: la llaman las rutas de cron (Vercel), el webhook de
// AgentMail y scripts/rutinas.ts (un computador). Todas dejan su rastro en la bitácora.

import { db } from "./db";
import { correrRadar } from "./radar";
import { generarFicha } from "./ficha";
import { revisarBuzon } from "./buzon";
import { enviarRecordatorios } from "./invitaciones";

/** Radar + fichas de lo nuevo. Una vez al día, temprano. */
export async function rutinaRadar() {
  const r = await correrRadar();
  const sinFicha = await db.oportunidad.findMany({ where: { origen: "secop", fichaGeneradaEn: null }, select: { id: true }, take: 15 });
  let fichas = 0;
  for (const o of sinFicha) { try { await generarFicha(o.id).catch(() => generarFicha(o.id)); fichas++; } catch { /* se reintenta mañana */ } }
  return { ...r, fichas };
}

export const rutinaBuzon = () => revisarBuzon();

/** Recordatorios a los proveedores que llevan 2 días sin responder. Una vez al día. */
export const rutinaRecordatorios = () => enviarRecordatorios(48);

/** Las rutas de cron solo responden con el secreto (Vercel lo manda como Bearer). */
export function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  return !!secreto && req.headers.get("authorization") === `Bearer ${secreto}`;
}
