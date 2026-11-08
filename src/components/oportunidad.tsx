import Link from "next/link";
import type { Oportunidad, Evento } from "@prisma/client";
import { Encaje, Insignia, Tarjeta } from "./ui";
import { IconoAgente, IconoPersona, IconoReloj, IconoRadar, IconoReenvio } from "./iconos";
import { ESTADO_OPORTUNIDAD, RECOMENDACION } from "@/lib/etiquetas";
import { cierre, copCorto, diasHasta, haceCuanto } from "@/lib/formato";
import type { Ficha } from "@/lib/ficha";

export const tituloDe = (o: Pick<Oportunidad, "titulo" | "ficha">) => (o.ficha as Ficha | null)?.titulo_corto ?? o.titulo;

function Urgencia({ fecha }: { fecha: Date | null }) {
  const n = diasHasta(fecha);
  const tono = n === null ? "text-tinta-3" : n < 0 ? "text-tinta-3" : n <= 7 ? "text-rojo" : n <= 14 ? "text-[#8a5a00]" : "text-tinta-2";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium ${tono}`}>
      <IconoReloj className="size-3.5" />
      {cierre(fecha)}
    </span>
  );
}

/** Una fila del tablero de oportunidades. */
export function FilaOportunidad({ o }: { o: Oportunidad }) {
  const rec = o.recomendacion ? RECOMENDACION[o.recomendacion] : null;
  const est = ESTADO_OPORTUNIDAD[o.estado];
  return (
    <Link href={`/oportunidades/${o.id}`} className="block">
      <Tarjeta viva className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_160px_120px_150px] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {o.origen === "secop" ? (
              <span className="inline-flex items-center gap-1 font-display text-[11.5px] font-bold uppercase tracking-[.08em] text-verde-profundo"><IconoRadar className="size-3.5" />SECOP</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-display text-[11.5px] font-bold uppercase tracking-[.08em] text-naranja"><IconoReenvio className="size-3.5" />Invitación</span>
            )}
            <span className="text-tinta-3">·</span>
            <span className="truncate text-[13px] text-tinta-3">{o.departamento ?? "Sin ubicación"}</span>
          </div>
          <h3 className="mt-1.5 text-[17px] font-bold leading-snug">{tituloDe(o)}</h3>
          <p className="mt-1 truncate text-[13.5px] text-tinta-2">{o.entidad}</p>
        </div>
        <div className="flex flex-col items-start gap-1.5">
          {rec ? <Insignia tono={rec.tono} punto>{rec.etiqueta}</Insignia> : <Insignia tono={est.tono}>{est.etiqueta}</Insignia>}
          <Encaje valor={o.encaje} ancho="w-20" />
        </div>
        <div>
          <div className="num text-[19px] font-extrabold">{copCorto(o.valorEstimado)}</div>
          <div className="text-[12px] text-tinta-3">presupuesto</div>
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <Urgencia fecha={o.fechaCierre} />
          {rec && <Insignia tono={est.tono}>{est.etiqueta}</Insignia>}
        </div>
      </Tarjeta>
    </Link>
  );
}

/** La bitácora: cada paso del agente y de las personas. */
export function Bitacora({ eventos }: { eventos: Evento[] }) {
  if (!eventos.length) return <p className="text-[14px] text-tinta-3">Todavía no hay movimientos.</p>;
  return (
    <ol className="m-0 list-none space-y-0 p-0">
      {eventos.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < eventos.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-linea" />}
          <span className={`grid size-8 shrink-0 place-items-center rounded-full ${e.actor === "agente" ? "bg-noche-2 text-oro" : "bg-verde-suave text-verde-profundo"}`}>
            {e.actor === "agente" ? <IconoAgente className="size-4" /> : <IconoPersona className="size-4" />}
          </span>
          <div className="min-w-0 pt-1">
            <p className="m-0 text-[14px] leading-snug text-tinta">{e.descripcion}</p>
            <p className="m-0 mt-0.5 text-[12px] text-tinta-3">{e.actor === "agente" ? "Agente" : "Persona"} · {haceCuanto(e.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
