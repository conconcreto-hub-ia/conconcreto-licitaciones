// La decisión del comité. La acción de Next la llama; los scripts de prueba también.
import { db } from "./db";

export const COMITE = "Comité de licitaciones";
export type Decision = "aprobar" | "descartar" | "llevar";

export async function decidir(id: string, decision: Decision, nota: string, quien: string = COMITE) {
  nota = nota.trim();
  if (decision === "descartar" && !nota) throw new Error("Para descartar hay que dejar la razón.");
  const estado = decision === "aprobar" ? "aprobada" : decision === "descartar" ? "descartada" : "en_comite";
  await db.$transaction([
    db.oportunidad.update({
      where: { id },
      data: { estado, decision: nota || null, decididoPor: decision === "llevar" ? null : quien, decididoEn: decision === "llevar" ? null : new Date() },
    }),
    db.evento.create({
      data: {
        oportunidadId: id, actor: "persona",
        tipo: decision === "aprobar" ? "comite.aprobo" : decision === "descartar" ? "comite.descarto" : "comite.agendo",
        descripcion: decision === "aprobar" ? `${quien} aprobó presentarse${nota ? ` · ${nota}` : ""}` : decision === "descartar" ? `${quien} la descartó · ${nota}` : "Se llevó al comité",
      },
    }),
  ]);
}
