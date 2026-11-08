"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { correrRadar } from "@/lib/radar";
import { generarFicha } from "@/lib/ficha";
import { decidir, type Decision } from "@/lib/comite";

export async function decidirEnComite(formData: FormData) {
  const id = String(formData.get("id"));
  await decidir(id, String(formData.get("decision")) as Decision, String(formData.get("nota") ?? ""));
  revalidatePath("/");
  revalidatePath(`/oportunidades/${id}`);
}

export async function correrRadarAhora() {
  const r = await correrRadar();
  // Las nuevas salen con ficha de una vez: es lo que hace que el radar valga la pena.
  const sinFicha = await db.oportunidad.findMany({ where: { origen: "secop", fichaGeneradaEn: null }, select: { id: true }, take: 10 });
  for (const o of sinFicha) {
    try { await generarFicha(o.id).catch(() => generarFicha(o.id)); } catch { /* queda sin ficha y se reintenta en la próxima corrida */ }
  }
  revalidatePath("/");
  revalidatePath("/radar");
  return r;
}

export async function rehacerFicha(formData: FormData) {
  const id = String(formData.get("id"));
  await generarFicha(id);
  revalidatePath(`/oportunidades/${id}`);
  revalidatePath("/");
}

export async function revisarBuzonAhora() {
  const { revisarBuzon } = await import("@/lib/buzon");
  const r = await revisarBuzon();
  revalidatePath("/");
  revalidatePath("/buzon");
  return r;
}

export async function proponerPaquetesAhora(oportunidadId: string) {
  const { proponerPaquetes } = await import("@/lib/paquetes");
  const r = await proponerPaquetes(oportunidadId);
  revalidatePath(`/oportunidades/${oportunidadId}`);
  return r;
}

export async function confirmarPaquetesAhora(oportunidadId: string) {
  const { confirmarPaquetes } = await import("@/lib/paquetes");
  // Mientras no haya inicio de sesión, confirma «Licitaciones».
  const r = await confirmarPaquetes(oportunidadId, "Licitaciones");
  revalidatePath(`/oportunidades/${oportunidadId}`);
  revalidatePath("/");
  return r;
}

export async function sugerirProveedoresAhora(paqueteId: string) {
  const { sugerirProveedores } = await import("@/lib/proveedores");
  const r = await sugerirProveedores(paqueteId);
  revalidatePath(`/paquetes/${paqueteId}`);
  return r;
}

export async function aprobarYEnviarAhora(paqueteId: string) {
  const { aprobarYEnviar } = await import("@/lib/invitaciones");
  const r = await aprobarYEnviar(paqueteId, "Licitaciones");
  revalidatePath(`/paquetes/${paqueteId}`);
  return r;
}

export async function recordatoriosAhora(paqueteId: string) {
  const { enviarRecordatorios } = await import("@/lib/invitaciones");
  const r = await enviarRecordatorios(0);
  revalidatePath(`/paquetes/${paqueteId}`);
  return r;
}

export async function quitarInvitacion(invitacionId: string, paqueteId: string) {
  await db.invitacion.deleteMany({ where: { id: invitacionId, estado: "borrador" } });
  revalidatePath(`/paquetes/${paqueteId}`);
}
