// Proveedores: encontrarlos, verificarlos y elegir a quién invitar a cada paquete.
//
// Dos fuentes:
//   · la base de Conconcreto (Proveedor con fuente "base"), que es la que manda;
//   · el directorio de proveedores del SECOP (Croma), para encontrar nuevos por actividad y región.
// Todo proveedor se verifica antes de invitarlo: sanciones registradas y contratos públicos ejecutados.
// Un proveedor con sanciones no se invita (Sagrilaft y la política de Conconcreto lo piden).

import { db } from "./db";
import { cromaProveedores, CREDITOS } from "./croma";
import { pedirEstructurado } from "./claude";

const MAX_INVITADOS = 4;
const VERIFICAR_HASTA = 6;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tokens = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 3 && !["para", "con", "del", "los", "las", "suministro", "instalacion", "servicio"].includes(t)));

/** Verifica en el SECOP: sanciones y contratos ejecutados. 2 créditos. */
export async function verificarProveedor(id: string) {
  const p = await db.proveedor.findUniqueOrThrow({ where: { id } });
  if (!p.nit) {
    await db.proveedor.update({ where: { id }, data: { verificadoEn: new Date(), notas: "Sin NIT: no se puede verificar en el SECOP." } });
    return { creditos: 0 };
  }
  const nit = p.nit.replace(/\D/g, "").slice(0, 9);
  const [contratos, sanciones] = await Promise.all([
    cromaProveedores.contratos({ provider_document: nit, per_page: 1 }),
    cromaProveedores.sanciones({ provider_document: nit, per_page: 5 }),
  ]);
  await db.proveedor.update({
    where: { id },
    data: {
      contratosPublicos: contratos.total, sancionado: sanciones.total > 0, verificadoEn: new Date(),
      notas: sanciones.total ? `Sanciones en el SECOP: ${sanciones.results.map((s) => `${s.entity} (${s.published_date ?? "s. f."})`).join("; ")}` : p.notas,
    },
  });
  return { creditos: 2 * CREDITOS.dataset };
}

/** Busca en el directorio del SECOP empresas que podrían cotizar el paquete y las deja como proveedores verificados. */
async function buscarEnSecop(paquete: { nombre: string; porque: string | null }, departamento: string | null) {
  const { terminos } = await pedirEstructurado<{ terminos: string[] }>({
    sistema: "Ayudas a compras de una constructora colombiana a buscar proveedores en el directorio del SECOP. El directorio se busca por el NOMBRE de la empresa, así que propones palabras que suelen aparecer en la razón social de quienes cotizan ese paquete (ej. para concreto premezclado: «concretos», «premezclados»; para estructura metálica: «estructuras metalicas», «metalmecanica»). Sin tildes.",
    usuario: `Paquete: ${paquete.nombre}\nQuién lo cotiza: ${paquete.porque ?? ""}`,
    herramienta: { name: "terminos", description: "Entrega 2 o 3 términos de búsqueda.", input_schema: { type: "object", required: ["terminos"], properties: { terminos: { type: "array", maxItems: 3, items: { type: "string" } } } } },
  });
  const depto = departamento ? norm(departamento).toUpperCase() : undefined;
  let creditos = 0;
  const vistos = new Map<string, Awaited<ReturnType<typeof cromaProveedores.directorio>>["results"][number]>();
  for (const termino of terminos) {
    let r = await cromaProveedores.directorio({ query: termino, department: depto, active: "yes", per_page: 10 });
    creditos += CREDITOS.dataset;
    if (r.total < 3 && depto) { r = await cromaProveedores.directorio({ query: termino, active: "yes", per_page: 10 }); creditos += CREDITOS.dataset; }
    for (const x of r.results) if (x.document && !x.is_entity && !vistos.has(x.document)) vistos.set(x.document, x);
  }
  const ids: string[] = [];
  for (const x of [...vistos.values()].slice(0, VERIFICAR_HASTA)) {
    const nit = x.document!.replace(/\D/g, "");
    const p = await db.proveedor.upsert({
      where: { nit },
      update: { correo: x.email ?? undefined, telefono: x.phone ?? undefined, ciudad: x.city ?? undefined },
      create: { nombre: x.name ?? nit, nit, correo: x.email, telefono: x.phone, ciudad: x.city, actividades: [paquete.nombre], fuente: "secop", notas: x.legal_rep_name ? `Representante legal: ${x.legal_rep_name}` : null },
    });
    if (!p.verificadoEn) creditos += (await verificarProveedor(p.id)).creditos;
    ids.push(p.id);
  }
  return { ids, terminos, creditos };
}

/**
 * Elige a quién invitar: primero la base de Conconcreto que cotiza esa actividad, después lo que se encuentre
 * en el SECOP. Deja las invitaciones en borrador: no sale nada hasta que licitaciones las apruebe.
 */
export async function sugerirProveedores(paqueteId: string) {
  const paquete = await db.paquete.findUniqueOrThrow({ where: { id: paqueteId }, include: { oportunidad: true, invitaciones: true } });
  const clave = tokens(`${paquete.nombre} ${paquete.porque ?? ""}`);

  const base = (await db.proveedor.findMany({ where: { fuente: "base" } }))
    .map((p) => ({ p, puntos: p.actividades.reduce((s, a) => s + [...tokens(a)].filter((t) => clave.has(t)).length, 0) }))
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .map((x) => x.p);
  for (const p of base) if (!p.verificadoEn && p.nit) await verificarProveedor(p.id);

  const secop = base.length >= MAX_INVITADOS ? { ids: [], terminos: [], creditos: 0 } : await buscarEnSecop(paquete, paquete.oportunidad.departamento);
  const candidatos = await db.proveedor.findMany({ where: { id: { in: [...base.map((p) => p.id), ...secop.ids] } } });
  const orden = (id: string) => (base.some((b) => b.id === id) ? 0 : 1);
  const elegidos = candidatos
    .filter((p) => !p.sancionado && p.correo)
    .sort((a, b) => orden(a.id) - orden(b.id) || (b.contratosPublicos ?? 0) - (a.contratosPublicos ?? 0))
    .slice(0, MAX_INVITADOS);
  const descartados = candidatos.filter((p) => p.sancionado || !p.correo);

  for (const p of elegidos) {
    await db.invitacion.upsert({ where: { paqueteId_proveedorId: { paqueteId, proveedorId: p.id } }, update: {}, create: { paqueteId, proveedorId: p.id, estado: "borrador" } });
  }
  await db.evento.create({
    data: {
      oportunidadId: paquete.oportunidadId, actor: "agente", tipo: "proveedores.sugeridos",
      descripcion: `«${paquete.nombre}»: propuso ${elegidos.length} proveedores (${elegidos.filter((p) => orden(p.id) === 0).length} de la base, ${elegidos.filter((p) => orden(p.id) === 1).length} del SECOP)${descartados.some((p) => p.sancionado) ? ` · descartó ${descartados.filter((p) => p.sancionado).length} con sanciones` : ""}`,
      datos: { terminos: secop.terminos, creditos: secop.creditos },
    },
  });
  return { elegidos: elegidos.length, base: base.length, secop: secop.ids.length, sancionados: descartados.filter((p) => p.sancionado).length, sinCorreo: descartados.filter((p) => !p.correo).length, creditos: secop.creditos };
}
