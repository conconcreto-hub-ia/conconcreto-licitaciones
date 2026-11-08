// El radar del SECOP (puerta B).
//
// Pregunta a Croma por los procesos de obra publicados desde la última corrida, se queda con los que
// encajan con algún criterio de Conconcreto y todavía reciben ofertas, y los deja como oportunidades.
// La búsqueda por palabra se hace aquí y no en Croma: así un proceso que encaja en dos criterios
// cuesta una sola consulta.

import { db } from "./db";
import { croma, CREDITOS, type ProcesoSecop } from "./croma";
import type { Criterio } from "@prisma/client";

const DIAS_PRIMERA_CORRIDA = 21;
const PAGINAS_MAX = 3; // 300 procesos por modalidad y corrida es más que suficiente

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Devuelve el criterio con el que encaja el proceso, o null. */
export function criterioQueEncaja(p: ProcesoSecop, criterios: Criterio[]): Criterio | null {
  const texto = normal(`${p.name ?? ""} ${p.description ?? ""}`);
  const valor = p.base_price ?? 0;
  for (const c of criterios) {
    if (c.modalidades.length && !c.modalidades.includes(p.modality ?? "")) continue;
    if (c.departamentos.length && !c.departamentos.includes(p.entity_department ?? "")) continue;
    if (c.montoMinimo && valor < Number(c.montoMinimo)) continue;
    if (c.montoMaximo && valor > Number(c.montoMaximo)) continue;
    if (c.excluir.some((x) => texto.includes(normal(x)))) continue;
    if (c.palabrasClave.some((k) => new RegExp(`\\b${normal(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(texto))) return c;
  }
  return null;
}

/** ¿Sigue recibiendo ofertas? */
export function sigueAbierto(p: ProcesoSecop, hoy = new Date()): boolean {
  if (p.status && !/publicado|convocado|abierto/i.test(p.status)) return false;
  if (p.bid_deadline && p.bid_deadline < ymd(hoy)) return false;
  return true;
}

export type ResultadoRadar = { revisados: number; nuevos: number; creditos: number; error?: string };

export async function correrRadar(): Promise<ResultadoRadar> {
  const hasta = new Date();
  const ultima = await db.corridaRadar.findFirst({ where: { error: null }, orderBy: { hasta: "desc" } });
  const desde = ultima ? new Date(ultima.hasta.getTime() - 86_400_000) : new Date(hasta.getTime() - DIAS_PRIMERA_CORRIDA * 86_400_000);

  const criterios = await db.criterio.findMany({ where: { activo: true } });
  const modalidades = [...new Set(criterios.flatMap((c) => c.modalidades))];
  const minimo = Math.min(...criterios.map((c) => Number(c.montoMinimo ?? 0)));

  let revisados = 0, nuevos = 0, creditos = 0;
  const vistos = new Set<string>();

  try {
    for (const modalidad of modalidades.length ? modalidades : [""]) {
      for (let page = 1; page <= PAGINAS_MAX; page++) {
        const r = await croma.buscarProcesos({
          platform: "secop_ii", contract_type: "Obra", modality: modalidad, from_date: ymd(desde),
          min_value: minimo, sort: "recent", per_page: 100, page,
        });
        creditos += CREDITOS.dataset;
        for (const p of r.results) {
          if (!p.notice_uid || vistos.has(p.notice_uid)) continue;
          vistos.add(p.notice_uid);
          revisados++;
          if (!sigueAbierto(p)) continue;
          const c = criterioQueEncaja(p, criterios);
          if (!c) continue;
          const creada = await guardar(p, c);
          if (creada) nuevos++;
        }
        if (page >= r.total_pages) break;
      }
    }
    await db.corridaRadar.create({ data: { desde, hasta, revisados, nuevos, creditos } });
    return { revisados, nuevos, creditos };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.corridaRadar.create({ data: { desde, hasta, revisados, nuevos, creditos, error } });
    return { revisados, nuevos, creditos, error };
  }
}

async function guardar(p: ProcesoSecop, c: Criterio): Promise<boolean> {
  const codigo = p.notice_uid!;
  const existe = await db.oportunidad.findUnique({ where: { codigo }, select: { id: true } });
  const datos = {
    titulo: (p.name ?? p.description ?? codigo).trim(),
    objeto: p.description,
    entidad: p.entity ?? "Entidad sin nombre",
    entidadNit: p.entity_nit,
    departamento: p.entity_department,
    municipio: p.entity_city,
    modalidad: p.modality,
    tipologia: c.tipologia,
    valorEstimado: p.base_price ? BigInt(Math.round(p.base_price)) : null,
    fechaPublicacion: p.published_date ? new Date(`${p.published_date}T12:00:00-05:00`) : null,
    fechaCierre: p.bid_deadline ? new Date(`${p.bid_deadline}T23:59:00-05:00`) : null,
    urlFuente: p.url,
    criterioId: c.id,
    raw: p as object,
  };
  if (existe) {
    await db.oportunidad.update({ where: { id: existe.id }, data: datos });
    return false;
  }
  const o = await db.oportunidad.create({ data: { codigo, origen: "secop", ...datos } });
  await db.evento.create({
    data: {
      oportunidadId: o.id, actor: "agente", tipo: "radar.encontro",
      descripcion: `El radar la encontró en el SECOP · encaja con «${c.nombre}»`,
      datos: { criterio: c.nombre, valor: p.base_price, cierre: p.bid_deadline },
    },
  });
  return true;
}
