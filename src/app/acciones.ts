"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { correrRadar } from "@/lib/radar";
import { generarFicha } from "@/lib/ficha";

// Quién decide. Mientras no haya inicio de sesión, el comité firma con este nombre.
const COMITE = "Comité de licitaciones";

export async function decidirEnComite(formData: FormData) {
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")) as "aprobar" | "descartar" | "llevar";
  const nota = String(formData.get("nota") ?? "").trim();

  if (decision === "descartar" && !nota) throw new Error("Para descartar hay que dejar la razón.");

  const estado = decision === "aprobar" ? "aprobada" : decision === "descartar" ? "descartada" : "en_comite";
  await db.$transaction([
    db.oportunidad.update({
      where: { id },
      data: { estado, decision: nota || null, decididoPor: decision === "llevar" ? null : COMITE, decididoEn: decision === "llevar" ? null : new Date() },
    }),
    db.evento.create({
      data: {
        oportunidadId: id, actor: "persona",
        tipo: decision === "aprobar" ? "comite.aprobo" : decision === "descartar" ? "comite.descarto" : "comite.agendo",
        descripcion: decision === "aprobar" ? `El comité aprobó presentarse${nota ? ` · ${nota}` : ""}` : decision === "descartar" ? `El comité la descartó · ${nota}` : "Se llevó al comité",
      },
    }),
  ]);
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
