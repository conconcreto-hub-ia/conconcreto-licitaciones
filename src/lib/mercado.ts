// La inteligencia del mercado para una oportunidad del SECOP. Todo número sale de aquí, calculado
// por código sobre los datos de Croma. El modelo los interpreta; no los recalcula ni los inventa.

import { croma, CREDITOS, type ProcesoSecop } from "./croma";

export const NIT_CONCONCRETO = "890901110";

export type Mercado = {
  entidad: {
    obrasAdjudicadas: number;          // obras de la entidad con adjudicación en el histórico revisado
    descuentoMediano: number | null;   // 1 − adjudicado / presupuesto, mediana (0.074 = 7,4 %)
    descuentoRango: [number, number] | null;
    oferentesPromedio: number | null;  // proveedores distintos que ofertaron, en promedio
    ganadores: { nombre: string; documento: string | null; veces: number; valor: number }[];
    ejemplos: { nombre: string; presupuesto: number | null; adjudicado: number | null; ganador: string | null; fecha: string | null }[];
  };
  conconcreto: {
    ofertas_registradas_secop_ii: number;
    adjudicaciones: number;
    valorAdjudicado: number;
    conEstaEntidad: { veces: number; valor: number };
    mayores: { entidad: string; valor: number; fecha: string | null }[];
  };
  proceso: {
    interesados: number | null;
    oferentes: number | null;
    diasAlCierre: number | null;
  };
  creditos: number;
};

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function leerMercado(p: ProcesoSecop): Promise<Mercado> {
  let creditos = 0;

  // 1 · Lo que esta entidad ha contratado en obra y cómo lo adjudicó
  const historial = p.entity_nit
    ? await croma.buscarProcesos({ entity_nit: p.entity_nit, contract_type: "Obra", awarded: "yes", platform: "secop_ii", sort: "recent", per_page: 60 })
    : null;
  if (historial) creditos += CREDITOS.dataset;
  const pasadas = (historial?.results ?? []).filter((x) => x.notice_uid !== p.notice_uid);
  const descuentos = pasadas
    .filter((x) => x.base_price && x.awarded_value && x.awarded_value > 0 && x.awarded_value <= x.base_price * 1.05)
    .map((x) => 1 - (x.awarded_value as number) / (x.base_price as number));
  const oferentes = pasadas.map((x) => x.unique_responding_providers).filter((n): n is number => typeof n === "number" && n > 0);

  // 2 · Quién le gana a esta entidad
  const adj = p.entity_nit ? await croma.adjudicaciones({ entity_nit: p.entity_nit, per_page: 100, sort: "value_desc" }) : null;
  if (adj) creditos += CREDITOS.dataset;
  const porGanador = new Map<string, { nombre: string; documento: string | null; veces: number; valor: number }>();
  for (const a of adj?.results ?? []) {
    const k = a.provider_document ?? a.provider ?? "?";
    const g = porGanador.get(k) ?? { nombre: a.provider ?? "Sin nombre", documento: a.provider_document, veces: 0, valor: 0 };
    g.veces++; g.valor += a.value ?? 0;
    porGanador.set(k, g);
  }

  // 3 · El histórico público de Conconcreto
  const [ofertas, ganadas] = await Promise.all([
    croma.oferentes({ bidder_document: NIT_CONCONCRETO, per_page: 100 }),
    croma.adjudicaciones({ provider_document: NIT_CONCONCRETO, per_page: 100, sort: "value_desc" }),
  ]);
  creditos += 2 * CREDITOS.dataset;
  const conEsta = ganadas.results.filter((a) => p.entity_nit && a.entity_nit === p.entity_nit);

  const hoy = new Date();
  return {
    entidad: {
      obrasAdjudicadas: pasadas.length,
      descuentoMediano: mediana(descuentos),
      descuentoRango: descuentos.length >= 3 ? [Math.min(...descuentos), Math.max(...descuentos)] : null,
      oferentesPromedio: oferentes.length ? Math.round((oferentes.reduce((a, b) => a + b, 0) / oferentes.length) * 10) / 10 : null,
      ganadores: [...porGanador.values()].sort((a, b) => b.veces - a.veces || b.valor - a.valor).slice(0, 5),
      ejemplos: pasadas.slice(0, 5).map((x) => ({ nombre: (x.name ?? x.description ?? "").slice(0, 140), presupuesto: x.base_price, adjudicado: x.awarded_value, ganador: x.provider, fecha: x.award_date ?? x.published_date })),
    },
    conconcreto: {
      ofertas_registradas_secop_ii: ofertas.total,
      adjudicaciones: ganadas.total,
      valorAdjudicado: ganadas.results.reduce((s, a) => s + (a.value ?? 0), 0),
      conEstaEntidad: { veces: conEsta.length, valor: conEsta.reduce((s, a) => s + (a.value ?? 0), 0) },
      mayores: ganadas.results.slice(0, 3).map((a) => ({ entidad: a.entity ?? "", valor: a.value ?? 0, fecha: a.awarded_at })),
    },
    proceso: {
      interesados: p.interested_providers,
      oferentes: p.unique_responding_providers,
      diasAlCierre: p.bid_deadline ? Math.ceil((new Date(`${p.bid_deadline}T23:59:00-05:00`).getTime() - hoy.getTime()) / 86_400_000) : null,
    },
    creditos,
  };
}
