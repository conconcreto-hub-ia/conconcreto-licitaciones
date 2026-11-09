// En qué va cada licitación y qué necesita de una persona. Puro: recibe lo que hay en la base y devuelve las
// etapas y los pendientes humanos. Lo usan /procesos (el tablero) y /procesos/[id] (el hilo).
//
// Regla del producto: el agente propone y persigue; decidir, confirmar, aprobar, contestar una pregunta y
// adjudicar es de una persona. Cada pendiente de aquí es uno de esos momentos.
import type { EstadoInvitacion, EstadoOportunidad, EstadoPaquete, Origen } from "@prisma/client";
import { diasHasta } from "./formato";

export type EntradaProceso = {
  id: string;
  codigo: string;
  origen: Origen;
  estado: EstadoOportunidad;
  tieneFicha: boolean;
  formularios: number; // documentos de cantidades recibidos (pliegos del SECOP o formulario de la invitación)
  documentos?: number; // todos los documentos recibidos (especificaciones, planos, pliegos…)
  paquetes: {
    id: string;
    nombre: string;
    estado: EstadoPaquete;
    fechaLimite: Date | null;
    invitaciones: { estado: EstadoInvitacion; proveedor: string }[];
  }[];
};

export type ClaveEtapa = "entrada" | "ficha" | "comite" | "documentos" | "paquetes" | "invitaciones" | "cotizaciones" | "adjudicacion";

export const ETAPAS: { clave: ClaveEtapa; etiqueta: string; quien: "agente" | "persona" }[] = [
  { clave: "entrada", etiqueta: "Entró", quien: "agente" },
  { clave: "ficha", etiqueta: "Ficha go/no-go", quien: "agente" },
  { clave: "comite", etiqueta: "Comité", quien: "persona" },
  { clave: "documentos", etiqueta: "Pliegos y cantidades", quien: "persona" },
  { clave: "paquetes", etiqueta: "Paquetes", quien: "persona" },
  { clave: "invitaciones", etiqueta: "Invitaciones", quien: "persona" },
  { clave: "cotizaciones", etiqueta: "Cotizaciones", quien: "agente" },
  { clave: "adjudicacion", etiqueta: "Comparar y adjudicar", quien: "persona" },
];

export type Pendiente = {
  clave: string; // estable, para la key de React
  texto: string;
  detalle?: string;
  href: string;
  urgente: boolean;
};

export type EstadoProceso = {
  hechas: Record<ClaveEtapa, boolean>;
  actual: ClaveEtapa | null; // la primera sin hacer; null = todo hecho
  avance: number; // 0 a 1
  pendientes: Pendiente[];
  cotizaciones: { recibidas: number; invitados: number };
};

const MINIMO_COTIZACIONES = 3;
const ENVIADA: EstadoInvitacion[] = ["enviada", "recordada", "respondida", "cotizo", "declino"];

export function estadoDelProceso(p: EntradaProceso, ahora = new Date()): EstadoProceso {
  const decidido = ["aprobada", "en_cotizacion", "cerrada"].includes(p.estado);
  const confirmados = p.paquetes.filter((x) => x.estado === "confirmado");
  const todas = confirmados.flatMap((x) => x.invitaciones);
  const recibidas = todas.filter((i) => i.estado === "cotizo").length;
  const invitados = todas.filter((i) => ENVIADA.includes(i.estado)).length;

  const listoParaComparar = (x: EntradaProceso["paquetes"][number]) => {
    const cotizo = x.invitaciones.filter((i) => i.estado === "cotizo").length;
    const vencio = (diasHasta(x.fechaLimite, ahora) ?? 1) < 0;
    return cotizo >= MINIMO_COTIZACIONES || (vencio && cotizo > 0);
  };

  const hechas: Record<ClaveEtapa, boolean> = {
    entrada: true,
    ficha: p.tieneFicha,
    comite: decidido,
    documentos: decidido && p.formularios > 0,
    paquetes: p.paquetes.length > 0 && p.paquetes.every((x) => x.estado === "confirmado"),
    invitaciones: confirmados.length > 0 && confirmados.every((x) => x.invitaciones.some((i) => ENVIADA.includes(i.estado)) && !x.invitaciones.some((i) => i.estado === "borrador")),
    cotizaciones: confirmados.length > 0 && confirmados.every(listoParaComparar),
    adjudicacion: p.estado === "cerrada",
  };
  // Cerrada (se presentó la oferta o venció) es el final, aunque no haya pasado por todas las etapas.
  const cerrada = p.estado === "cerrada";
  const actual = cerrada ? null : ETAPAS.find((e) => !hechas[e.clave])?.clave ?? null;
  const avance = cerrada ? 1 : ETAPAS.filter((e) => hechas[e.clave]).length / ETAPAS.length;

  const ficha = `/oportunidades/${p.id}`;
  const pendientes: Pendiente[] = [];
  if (p.estado === "descartada" || p.estado === "cerrada") return { hechas, actual, avance, pendientes, cotizaciones: { recibidas, invitados } };

  if (!decidido) {
    pendientes.push({ clave: "comite", texto: "El comité tiene que decidir si Conconcreto se presenta", detalle: p.tieneFicha ? "La ficha de go/no-go está lista." : "La ficha todavía no está.", href: ficha, urgente: true });
    return { hechas, actual, avance, pendientes, cotizaciones: { recibidas, invitados } };
  }
  if (p.formularios === 0) {
    const llegaron = p.documentos ?? 0;
    pendientes.push(llegaron > 0
      ? { clave: "pliegos", texto: "Falta el formulario de cantidades", detalle: `Llegaron ${llegaron} ${llegaron === 1 ? "documento" : "documentos"}, pero ninguno es el formulario de cantidades (el Excel). Reenvíalo al buzón con «${p.codigo}» en el asunto para que el agente arme los paquetes.`, href: ficha, urgente: true }
      : p.origen === "secop"
        ? { clave: "pliegos", texto: "Reenviar los pliegos del SECOP al buzón del agente", detalle: `Con «${p.codigo}» en el asunto, para que el agente arme los paquetes.`, href: ficha, urgente: true }
        : { clave: "pliegos", texto: "Falta el formulario de cantidades de la invitación", detalle: "Reenvíalo al buzón en el mismo hilo para que el agente arme los paquetes.", href: ficha, urgente: true });
  }
  const propuestos = p.paquetes.filter((x) => x.estado === "propuesto");
  if (propuestos.length) {
    pendientes.push({ clave: "paquetes", texto: `Confirmar ${propuestos.length === 1 ? "el paquete que propuso" : `los ${propuestos.length} paquetes que propuso`} el agente`, detalle: "Revisa que cada actividad quede en el paquete correcto; al confirmar sale su BIMBAU.", href: ficha, urgente: true });
  }
  for (const x of confirmados) {
    const ruta = `/paquetes/${x.id}`;
    const borradores = x.invitaciones.filter((i) => i.estado === "borrador").length;
    if (borradores) pendientes.push({ clave: `inv-${x.id}`, texto: `Aprobar ${borradores === 1 ? "la invitación" : `${borradores} invitaciones`} de «${x.nombre}»`, detalle: "El agente las dejó redactadas con el BIMBAU adjunto; salen cuando las apruebes.", href: ruta, urgente: true });
    for (const i of x.invitaciones.filter((i) => i.estado === "respondida")) {
      pendientes.push({ clave: `preg-${x.id}-${i.proveedor}`, texto: `${i.proveedor} escribió sobre «${x.nombre}»`, detalle: "Es una pregunta o un comentario: el agente no la contesta, la contesta licitaciones en el hilo.", href: ruta, urgente: true });
    }
    if (listoParaComparar(x)) {
      pendientes.push({ clave: `comp-${x.id}`, texto: `Comparar las cotizaciones de «${x.nombre}» y decidir`, detalle: `${x.invitaciones.filter((i) => i.estado === "cotizo").length} cotizaciones recibidas. El agente arma el cuadro; adjudica una persona.`, href: ruta, urgente: false });
    } else {
      const d = diasHasta(x.fechaLimite, ahora);
      const cotizo = x.invitaciones.filter((i) => i.estado === "cotizo").length;
      if (!borradores && x.invitaciones.length > 0 && d !== null && d >= 0 && d <= 7 && cotizo < MINIMO_COTIZACIONES) {
        pendientes.push({ clave: `riesgo-${x.id}`, texto: `«${x.nombre}» deja de recibir cotizaciones en ${d === 0 ? "horas" : `${d} ${d === 1 ? "día" : "días"}`} y lleva ${cotizo} de ${MINIMO_COTIZACIONES}`, detalle: "Invitar a más proveedores o ampliar el plazo.", href: ruta, urgente: true });
      }
    }
  }
  // Los paquetes sin proveedores van en un solo pendiente: uno por paquete llenaba la lista de ruido.
  const sinProveedores = confirmados.filter((x) => x.invitaciones.length === 0);
  if (sinProveedores.length) {
    const nombres = sinProveedores.map((x) => `«${x.nombre}»`);
    pendientes.push({
      clave: "sinprov",
      texto: sinProveedores.length === 1 ? `${nombres[0]} todavía no tiene proveedores invitados` : `${sinProveedores.length} paquetes todavía no tienen proveedores invitados`,
      detalle: `${sinProveedores.length > 1 ? `${nombres.slice(0, 4).join(", ")}${sinProveedores.length > 4 ? ` y ${sinProveedores.length - 4} más` : ""}. ` : ""}Elige a quién invitar en cada uno; el agente sugiere de la base y del SECOP.`,
      href: sinProveedores.length === 1 ? `/paquetes/${sinProveedores[0].id}` : `/procesos/${p.id}`,
      urgente: false,
    });
  }
  return { hechas, actual, avance, pendientes, cotizaciones: { recibidas, invitados } };
}
