// Cliente de Croma (https://usecroma.com) para el SECOP.
//
// Lo que sí trae: búsqueda de procesos con filtros, adjudicaciones, oferentes por proceso,
// contratos y sanciones. Lo que NO trae: los documentos del proceso (pliegos, anexos, adendas)
// ni alertas: lo nuevo se encuentra preguntando con `from_date` en cada corrida del radar.
//
// Costo: una consulta a los datasets (los *-search) vale 1 crédito; una en vivo, 10.
// Por eso el radar usa solo *-search.

const BASE = "https://api.croma.run";

export class CromaError extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje);
  }
}

async function post<T>(ruta: string, cuerpo: Record<string, unknown>): Promise<T> {
  const llave = process.env.CROMA_API_KEY;
  if (!llave) throw new CromaError(0, "Falta CROMA_API_KEY en .env.local");
  const res = await fetch(`${BASE}${ruta}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });
  if (!res.ok) throw new CromaError(res.status, `Croma ${ruta} respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

type Pagina<T> = {
  as_of: string | null;
  total: number;
  total_is_exact: boolean;
  page: number;
  per_page: number;
  total_pages: number;
  count: number;
  results: T[];
};

export type ProcesoSecop = {
  id: string; // secop_ii:CO1.REQ.1234567
  platform: "secop_i" | "secop_ii";
  process_id: string | null;
  reference: string | null;
  notice_uid: string | null; // CO1.NTC.*
  entity: string | null;
  entity_nit: string | null;
  entity_department: string | null;
  entity_city: string | null;
  name: string | null;
  description: string | null;
  unspsc_code: string | null;
  modality: string | null;
  contract_type: string | null;
  base_price: number | null;
  awarded_value: number | null;
  phase: string | null;
  status: string | null;
  awarded: boolean | null;
  published_date: string | null;
  last_published_date: string | null;
  bid_deadline: string | null;
  award_date: string | null;
  invited_providers: number | null;
  interested_providers: number | null;
  unique_responding_providers: number | null;
  provider: string | null;
  provider_document: string | null;
  execution_locations: string | null;
  duration: number | null;
  duration_unit: string | null;
  url: string | null;
};

export type Adjudicacion = {
  id: string;
  process_id: string | null;
  notice_uid: string | null;
  entity: string | null;
  entity_nit: string | null;
  provider: string | null;
  provider_document: string | null;
  provider_department: string | null;
  provider_city: string | null;
  value: number | null;
  awarded_at: string | null;
  year: number | null;
  url: string | null;
};

export type Oferente = {
  id: string;
  process_id: string | null;
  bidder: string | null;
  bidder_document: string | null;
  awarded: boolean | null;
  published_date: string | null;
  year: number | null;
};

export type FiltrosProcesos = {
  query?: string;
  platform?: "any" | "secop_i" | "secop_ii";
  entity_nit?: string;
  department?: string;
  modality?: string;
  contract_type?: string;
  status?: string;
  unspsc_code?: string;
  year?: number;
  from_date?: string; // yyyy-mm-dd
  to_date?: string;
  min_value?: number;
  max_value?: number;
  sort?: "recent" | "oldest" | "value_desc" | "value_asc";
  awarded?: "any" | "yes" | "no";
  page?: number;
  per_page?: number;
};

/** Los parámetros vacíos se omiten: la API rechaza propiedades desconocidas y trata "" como "sin filtro". */
const limpio = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== 0));

export const croma = {
  buscarProcesos: (f: FiltrosProcesos) => post<Pagina<ProcesoSecop>>("/co/secop/processes-search/v1", limpio(f)),

  adjudicaciones: (f: { query?: string; entity_nit?: string; provider_document?: string; process_id?: string; from_date?: string; sort?: string; per_page?: number; page?: number }) =>
    post<Pagina<Adjudicacion>>("/co/secop/awards-search/v1", limpio(f)),

  oferentes: (f: { process_id?: string; bidder_document?: string; year?: number; per_page?: number; page?: number }) =>
    post<Pagina<Oferente>>("/co/secop/bidders-search/v1", limpio(f)),

  /** Detalle en vivo de un proceso de SECOP II (10 créditos). Solo para lo que ya pasó el filtro. */
  procesoEnVivo: (notice_uid: string) => post<Record<string, unknown>>("/co/secop/process/v1", { notice_uid }),
};

/** Créditos que gasta cada tipo de consulta, para llevar la cuenta en CorridaRadar. */
export const CREDITOS = { dataset: 1, vivo: 10 } as const;

/* ── Proveedores: directorio, contratos y sanciones ─────────────────── */

export type ProveedorSecop = {
  id: string; name: string | null; document: string | null; is_entity: boolean | null; is_active: boolean | null;
  unspsc_description: string | null; department: string | null; city: string | null; phone: string | null; email: string | null;
  website: string | null; legal_rep_name: string | null; registered_date: string | null;
};
export type ContratoSecop = { id: string; entity: string | null; provider: string | null; provider_document: string | null; object: string | null; description: string | null; value: number | null; sign_date: string | null; status: string | null };
export type SancionSecop = { id: string; entity: string | null; provider: string | null; provider_document: string | null; resolution_number: string | null; value: number | null; published_date: string | null; url: string | null };

export const cromaProveedores = {
  directorio: (f: { query?: string; document?: string; department?: string; unspsc_code?: string; active?: "yes" | "no" | "any"; per_page?: number; page?: number }) =>
    post<Pagina<ProveedorSecop>>("/co/secop/suppliers-search/v1", limpio(f)),
  contratos: (f: { provider_document?: string; query?: string; department?: string; per_page?: number; sort?: string }) =>
    post<Pagina<ContratoSecop>>("/co/secop/contracts-search/v1", limpio(f)),
  sanciones: (f: { provider_document?: string; per_page?: number }) =>
    post<Pagina<SancionSecop>>("/co/secop/sanctions-search/v1", limpio(f)),
};
