"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Marca, Contenedor } from "./ui";

// El menú vive aquí y en ningún otro sitio.
export const NAV = [
  { href: "/", etiqueta: "Oportunidades" },
  { href: "/radar", etiqueta: "Radar SECOP" },
  { href: "/buzon", etiqueta: "Buzón" },
  { href: "/proveedores", etiqueta: "Proveedores" },
  { href: "/criterios", etiqueta: "Criterios" },
] as const;

export function Barra({ agenteActivo = true }: { agenteActivo?: boolean }) {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/" ? ruta === "/" || ruta.startsWith("/oportunidades") : ruta.startsWith(href));

  return (
    <header className="banda">
      <Contenedor className="flex flex-wrap items-center justify-between gap-4 pt-5">
        <Link href="/" aria-label="Inicio">
          <Marca compacta />
        </Link>
        <div className="flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[.06] px-3.5 py-1.5 text-[12.5px] font-semibold text-white/85">
          {agenteActivo ? <span className="punto-vivo" /> : <span className="size-2 rounded-full bg-white/30" />}
          {agenteActivo ? "Agente activo" : "Agente en pausa"}
        </div>
      </Contenedor>
      <Contenedor>
        <nav className="-mb-px mt-5 flex gap-1 overflow-x-auto pb-[3px]" aria-label="Principal">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={
                "relative whitespace-nowrap px-3.5 py-3 font-display text-[14px] font-semibold transition-colors " +
                (activo(n.href) ? "text-white" : "text-white/55 hover:text-white/85")
              }
            >
              {n.etiqueta}
              {activo(n.href) && <span className="absolute inset-x-3.5 bottom-0 h-[3px] rounded-t-full bg-white" />}
            </Link>
          ))}
        </nav>
      </Contenedor>
    </header>
  );
}
