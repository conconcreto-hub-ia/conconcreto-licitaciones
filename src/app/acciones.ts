"use server";
// Cada acción exige su permiso con la sesión de la base: no basta con que la pantalla esconda el botón,
// porque una acción de servidor se puede llamar directamente. Y firma con el nombre de quien la hizo.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generarFicha } from "@/lib/ficha";
import { decidir, type Decision } from "@/lib/comite";
import { exigir } from "@/lib/auth/sesion";

export async function decidirEnComite(formData: FormData) {
  const yo = await exigir("comite.decidir");
  const id = String(formData.get("id"));
  await decidir(id, String(formData.get("decision")) as Decision, String(formData.get("nota") ?? ""), yo.nombre);
  revalidatePath("/");
  revalidatePath(`/oportunidades/${id}`);
}

export async function correrRadarAhora() {
  await exigir("radar.correr");
  const { rutinaRadar } = await import("@/lib/rutinas");
  const r = await rutinaRadar();
  revalidatePath("/");
  revalidatePath("/radar");
  return r;
}

export async function rehacerFicha(formData: FormData) {
  await exigir("ficha.rehacer");
  const id = String(formData.get("id"));
  await generarFicha(id);
  revalidatePath(`/oportunidades/${id}`);
  revalidatePath("/");
}

export async function revisarBuzonAhora() {
  await exigir("buzon.revisar");
  const { revisarBuzon } = await import("@/lib/buzon");
  const r = await revisarBuzon();
  revalidatePath("/");
  revalidatePath("/buzon");
  return r;
}

export async function proponerPaquetesAhora(oportunidadId: string) {
  await exigir("paquetes.editar");
  const { proponerPaquetes } = await import("@/lib/paquetes");
  const r = await proponerPaquetes(oportunidadId);
  revalidatePath(`/oportunidades/${oportunidadId}`);
  return r;
}

export async function confirmarPaquetesAhora(oportunidadId: string) {
  const yo = await exigir("paquetes.editar");
  const { confirmarPaquetes } = await import("@/lib/paquetes");
  const r = await confirmarPaquetes(oportunidadId, yo.nombre);
  revalidatePath(`/oportunidades/${oportunidadId}`);
  revalidatePath("/");
  return r;
}

export async function moverActividadAhora(oportunidadId: string, actividadId: string, desdeId: string, haciaId: string) {
  const yo = await exigir("paquetes.editar");
  const { moverActividad } = await import("@/lib/paquetes");
  await moverActividad(actividadId, desdeId, haciaId, yo.nombre);
  revalidatePath(`/oportunidades/${oportunidadId}`);
}

export async function sugerirProveedoresAhora(paqueteId: string) {
  await exigir("proveedores.invitar");
  const { sugerirProveedores } = await import("@/lib/proveedores");
  const r = await sugerirProveedores(paqueteId);
  revalidatePath(`/paquetes/${paqueteId}`);
  return r;
}

export async function aprobarYEnviarAhora(paqueteId: string) {
  const yo = await exigir("proveedores.invitar");
  const { aprobarYEnviar } = await import("@/lib/invitaciones");
  const r = await aprobarYEnviar(paqueteId, yo.nombre);
  revalidatePath(`/paquetes/${paqueteId}`);
  return r;
}

/** Recordar ya, a los pendientes de ESTE paquete (el botón no espera las 48 horas de la rutina). */
export async function recordatoriosAhora(paqueteId: string) {
  await exigir("proveedores.invitar");
  const { enviarRecordatorios } = await import("@/lib/invitaciones");
  const r = await enviarRecordatorios(0, paqueteId);
  revalidatePath(`/paquetes/${paqueteId}`);
  return r;
}

export async function quitarInvitacion(invitacionId: string, paqueteId: string) {
  await exigir("proveedores.invitar");
  await db.invitacion.deleteMany({ where: { id: invitacionId, paqueteId, estado: "borrador" } });
  revalidatePath(`/paquetes/${paqueteId}`);
}
