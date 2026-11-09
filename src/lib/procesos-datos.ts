import "server-only";
// Lo que leen /procesos y /procesos/[id] de la base, ya armado para estadoDelProceso().
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { estadoDelProceso, type EntradaProceso } from "./procesos";
import type { Ficha } from "./ficha";

/** Las licitaciones que ya se están licitando: el comité dijo que sí. Las cerradas van aparte. */
export const EN_CURSO: Prisma.OportunidadWhereInput = { estado: { in: ["aprobada", "en_cotizacion"] } };

const incluir = {
  paquetes: {
    orderBy: { nombre: "asc" },
    include: { invitaciones: { include: { proveedor: { select: { nombre: true } }, cotizacion: { select: { valorTotal: true } } } } },
  },
  _count: { select: { documentos: { where: { tipo: "formulario" } } } },
  documentos: { select: { id: true } },
  eventos: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.OportunidadInclude;

export type OportunidadConProceso = Prisma.OportunidadGetPayload<{ include: typeof incluir }>;

export const entrada = (o: OportunidadConProceso): EntradaProceso => ({
  id: o.id, codigo: o.codigo, origen: o.origen, estado: o.estado, tieneFicha: !!o.ficha, formularios: o._count.documentos, documentos: o.documentos.length,
  paquetes: o.paquetes.map((p) => ({ id: p.id, nombre: p.nombre, estado: p.estado, fechaLimite: p.fechaLimite, invitaciones: p.invitaciones.map((i) => ({ estado: i.estado, proveedor: i.proveedor.nombre })) })),
});

export const tituloCorto = (o: { titulo: string; ficha: unknown }) => (o.ficha as Ficha | null)?.titulo_corto ?? o.titulo;

export async function cargarProcesos(where: Prisma.OportunidadWhereInput) {
  const ops = await db.oportunidad.findMany({ where, include: incluir, orderBy: [{ fechaCierre: { sort: "asc", nulls: "last" } }] });
  return ops.map((o) => ({ o, e: estadoDelProceso(entrada(o)) }));
}

export async function cargarProceso(id: string) {
  const o = await db.oportunidad.findUnique({ where: { id }, include: incluir });
  return o ? { o, e: estadoDelProceso(entrada(o)) } : null;
}
