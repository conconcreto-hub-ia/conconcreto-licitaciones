// Las piezas de /procesos: la barra de etapas y la lista de lo que necesita a una persona.
import Link from "next/link";
import { ETAPAS, type EstadoProceso, type Pendiente } from "@/lib/procesos";
import { IconoAgente, IconoCheck, IconoFlecha, IconoPersona } from "./iconos";

/** Las ocho etapas: hechas en verde, la actual resaltada, las que faltan en gris. Dice quién mueve cada una. */
export function Etapas({ e, compacta = false, oscura = false }: { e: EstadoProceso; compacta?: boolean; oscura?: boolean }) {
  return (
    <ol className={"grid gap-1.5 pl-0 " + (compacta ? "grid-cols-8" : "grid-cols-4 sm:grid-cols-8")} aria-label="Etapas de la licitación">
      {ETAPAS.map((et, i) => {
        const hecha = e.hechas[et.clave], actual = e.actual === et.clave;
        const barra = hecha ? "bg-verde" : actual ? "[background:var(--degradado)]" : oscura ? "bg-white/15" : "bg-linea";
        const texto = hecha ? (oscura ? "text-white/80" : "text-tinta-2") : actual ? (oscura ? "text-white" : "text-tinta") : oscura ? "text-white/40" : "text-tinta-3";
        return (
          <li key={et.clave} className="list-none" title={`${i + 1}. ${et.etiqueta} · la mueve ${et.quien === "agente" ? "el agente" : "una persona"}`}>
            <div className={"h-1.5 rounded-full " + barra} />
            {!compacta && (
              <div className={"mt-2 flex items-start gap-1 text-[11.5px] font-semibold leading-tight " + texto}>
                {hecha ? <IconoCheck className="mt-px size-3 shrink-0 text-verde" /> : et.quien === "persona" ? <IconoPersona className="mt-px size-3 shrink-0 opacity-70" /> : <IconoAgente className="mt-px size-3 shrink-0 opacity-70" />}
                <span>{et.etiqueta}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const etiquetaEtapa = (e: EstadoProceso) => (e.actual ? ETAPAS.find((x) => x.clave === e.actual)!.etiqueta : "Terminada");

/** Lo que espera a una persona. Cada fila lleva a donde se resuelve. */
export function ListaPendientes({ pendientes, proceso }: { pendientes: Pendiente[]; proceso?: (p: Pendiente) => string | null }) {
  return (
    <ul className="divide-y divide-linea-2 pl-0">
      {pendientes.map((p) => (
        <li key={p.clave} className="list-none">
          <Link href={p.href} className="group flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-fondo">
            <span className={"mt-0.5 grid size-8 shrink-0 place-items-center rounded-full " + (p.urgente ? "bg-oro-suave text-[#8a5a00]" : "bg-verde-suave text-verde-profundo")}>
              <IconoPersona className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              {proceso && proceso(p) && <div className="mb-0.5 truncate text-[12px] font-semibold text-tinta-3">{proceso(p)}</div>}
              <div className="text-[14.5px] font-semibold leading-snug text-tinta">{p.texto}</div>
              {p.detalle && <div className="mt-0.5 text-[13px] leading-snug text-tinta-2">{p.detalle}</div>}
            </div>
            <IconoFlecha className="mt-2 size-4 shrink-0 text-tinta-3 transition-transform group-hover:translate-x-0.5 group-hover:text-tinta" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
