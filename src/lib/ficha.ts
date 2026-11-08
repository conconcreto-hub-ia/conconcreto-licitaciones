// La ficha de go/no-go de una oportunidad.
//
// Reparto: `mercado.ts` calcula todas las cifras con código. Claude lee esas cifras, el objeto del
// proceso y el criterio, y escribe la recomendación con sus razones. Nunca decide: recomienda para
// el comité, que es quien aprueba.

import { db } from "./db";
import { leerMercado, type Mercado } from "./mercado";
import type { ProcesoSecop } from "./croma";
import type { Recomendacion } from "@prisma/client";
import { MODELO, pedirEstructurado } from "./claude";

export type FichaIA = {
  titulo_corto: string;
  resumen: string;
  recomendacion: Recomendacion;
  encaje: number;
  hallazgo: string;
  razones: { titulo: string; detalle: string }[];
  riesgos: string[];
  preguntas_comite: string[];
};

/** `mercado` solo existe en los procesos del SECOP; una invitación privada no tiene histórico público. */
export type Ficha = FichaIA & { mercado: Mercado | null; modelo: string; faltantes?: string[]; recibidos?: string[] };

export const etiquetaRecomendacion = (r: Recomendacion) => (r === "go" ? "presentarse" : r === "no_go" ? "no presentarse" : "revisar en comité");

const HERRAMIENTA = {
  name: "entregar_ficha",
  description: "Entrega la ficha de go/no-go para el comité de licitaciones.",
  input_schema: {
    type: "object",
    required: ["titulo_corto", "resumen", "recomendacion", "encaje", "hallazgo", "razones", "riesgos", "preguntas_comite"],
    properties: {
      titulo_corto: { type: "string", description: "Qué se construye y dónde, en máximo 70 caracteres. Ej.: «Puente vehicular sobre el río Ariari · Meta». Nunca el código del proceso." },
      resumen: { type: "string", description: "Dos frases: qué es el proceso y por qué importa o no para Conconcreto." },
      recomendacion: { type: "string", enum: ["go", "revisar", "no_go"] },
      encaje: { type: "integer", minimum: 0, maximum: 100, description: "Qué tanto encaja con lo que Conconcreto hace y gana." },
      hallazgo: { type: "string", description: "El dato del mercado más útil para el comité, en una frase, con su cifra. Es lo que nadie en la sala sabía." },
      razones: { type: "array", maxItems: 4, items: { type: "object", required: ["titulo", "detalle"], properties: { titulo: { type: "string" }, detalle: { type: "string" } } } },
      riesgos: { type: "array", maxItems: 4, items: { type: "string" } },
      preguntas_comite: { type: "array", maxItems: 3, items: { type: "string" }, description: "Lo que el comité tendría que resolver antes de decidir." },
    },
  },
} as const;

const SISTEMA = `Eres el analista de licitaciones de Conconcreto, una constructora colombiana de 65 años especializada en infraestructura (puentes, túneles, vías, hidroeléctricas), vivienda y proyectos privados. Preparas la ficha que el comité lee antes de decidir si la compañía se presenta a un proceso público del SECOP.

Reglas:
- Usa SOLO las cifras que vienen en los datos. No inventes, no estimes y no redondees distinto. Si un dato no está, di que no está.
- Los descuentos vienen como fracción (0.074 = 7,4 %). Los valores están en pesos colombianos: exprésalos en millones (ej. «$25.880 millones»).
- Recomiendas; no decides. Toda licitación tiene preguntas abiertas (requisitos habilitantes, estudios, socios): eso va en «preguntas_comite» y NO es razón para «revisar». Usa la regla de «señales», que viene calculada por código:
  · «go»: la tipología es del núcleo de Conconcreto (señales.tipologia_nucleo), el plazo alcanza (señales.dias_al_cierre ≥ 10) y la escala es de Conconcreto (señales.escala_conconcreto). El mercado puede ser difícil y aun así es «go»: el riesgo se dice en riesgos.
  · «no_go»: el plazo no alcanza (señales.dias_al_cierre < 5), o la tipología no es del núcleo y la escala es menor, o el objeto es otra cosa (mantenimiento menor, obra turística o paisajística, dotación).
  · «revisar»: solo cuando una señal concreta pone la decisión en duda (plazo entre 5 y 9 días, escala límite, objeto mixto con diseño y obra, o un dato del mercado que lo cambia todo). Di cuál en el resumen.
- El encaje (0-100) mide qué tanto es el tipo de obra que Conconcreto hace y gana, no qué tan seguro estás.
- Escribe las fechas como se dicen («3 de diciembre»), nunca en formato 2026-12-03.
- El histórico de Conconcreto tiene dos fuentes que no se comparan entre sí: «ofertas_registradas_secop_ii» son solo las ofertas que SECOP II registra (desde 2015, incompleto), y «adjudicaciones» incluye SECOP I y II. No calcules una tasa de éxito con ellas.
- Escribe en español neutro, con tuteo cuando te dirijas a alguien, en tono de comité: directo y concreto, sin adjetivos de relleno.
- Entrega la ficha con la herramienta entregar_ficha.`;

export async function generarFicha(oportunidadId: string): Promise<Ficha> {
  const o = await db.oportunidad.findUniqueOrThrow({ where: { id: oportunidadId }, include: { criterio: true } });
  if (o.origen !== "secop" || !o.raw) throw new Error("La ficha con mercado es para procesos del SECOP.");
  const proceso = o.raw as unknown as ProcesoSecop;

  const mercado = await leerMercado(proceso);

  const entrada = {
    proceso: {
      codigo: o.codigo, nombre: proceso.name, objeto: proceso.description, entidad: o.entidad, departamento: o.departamento,
      municipio: o.municipio, modalidad: o.modalidad, presupuesto: proceso.base_price, cierre: proceso.bid_deadline,
      duracion: proceso.duration ? `${proceso.duration} ${proceso.duration_unit ?? ""}`.trim() : null,
    },
    criterio_con_el_que_encajo: o.criterio ? { nombre: o.criterio.nombre, tipologia: o.criterio.tipologia } : null,
    señales: {
      dias_al_cierre: mercado.proceso.diasAlCierre,
      tipologia_nucleo: ["Puentes", "Túneles", "Vías", "Energía", "Agua"].includes(o.criterio?.tipologia ?? ""),
      // Lo que Conconcreto ha ganado en el SECOP va de decenas a cientos de miles de millones.
      escala_conconcreto: (proceso.base_price ?? 0) >= 15_000_000_000,
      presupuesto_millones: proceso.base_price ? Math.round(proceso.base_price / 1_000_000) : null,
    },
    mercado,
  };

  const ia = await pedirEstructurado<FichaIA>({
    sistema: SISTEMA,
    herramienta: HERRAMIENTA,
    usuario: `Datos del proceso y del mercado (calculados por código):

${JSON.stringify(entrada, null, 1)}`,
  });

  const ficha: Ficha = { ...ia, encaje: Math.max(0, Math.min(100, Math.round(ia.encaje))), mercado, modelo: MODELO };

  await db.$transaction([
    db.oportunidad.update({
      where: { id: o.id },
      data: {
        ficha: ficha as object, recomendacion: ficha.recomendacion, encaje: ficha.encaje, fichaGeneradaEn: new Date(),
        estado: o.estado === "nueva" ? "analizada" : o.estado,
      },
    }),
    db.evento.create({
      data: {
        oportunidadId: o.id, actor: "agente", tipo: "ficha.generada",
        descripcion: `Armó la ficha de go/no-go · recomienda «${etiquetaRecomendacion(ficha.recomendacion)}»`,
        datos: { encaje: ficha.encaje, creditos: mercado.creditos },
      },
    }),
  ]);
  return ficha;
}
