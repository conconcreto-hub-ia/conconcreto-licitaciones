"use client";
// Los filtros del buzón: por licitación, por proveedor y por dirección. Viven en la URL (se pueden compartir
// y el botón «atrás» funciona); el filtrado lo hace el servidor.
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Opcion = { v: string; e: string };

export function FiltrosBuzon({ licitaciones, proveedores }: { licitaciones: Opcion[]; proveedores: Opcion[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pendiente, empezar] = useTransition();
  const valor = (k: string) => sp.get(k) ?? "";
  const cambiar = (k: string, v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(k, v); else q.delete(k);
    // Elegir una licitación y un proveedor que no se cruzan da vacío: se respeta, se ve y se limpia.
    empezar(() => router.push(`/buzon${q.toString() ? `?${q}` : ""}`, { scroll: false }));
  };
  const activos = ["licitacion", "proveedor", "dir"].filter((k) => sp.get(k)).length;
  const campo = "h-10 w-full rounded-ctl border bg-papel px-3 text-[13.5px] outline-none focus:border-verde disabled:opacity-60";

  return (
    <div className={"grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.8fr)_auto] sm:items-end " + (pendiente ? "opacity-70" : "")}>
      <label className="block text-[12.5px] font-semibold text-tinta-2">Licitación
        <select value={valor("licitacion")} onChange={(e) => cambiar("licitacion", e.target.value)} className={campo + (valor("licitacion") ? " border-verde/60" : " border-linea")}>
          <option value="">Todas</option>
          <option value="ninguna">Sin licitación</option>
          {licitaciones.map((o) => <option key={o.v} value={o.v}>{o.e}</option>)}
        </select>
      </label>
      <label className="block text-[12.5px] font-semibold text-tinta-2">Proveedor
        <select value={valor("proveedor")} onChange={(e) => cambiar("proveedor", e.target.value)} className={campo + (valor("proveedor") ? " border-verde/60" : " border-linea")}>
          <option value="">Todos</option>
          {proveedores.map((o) => <option key={o.v} value={o.v}>{o.e}</option>)}
        </select>
      </label>
      <label className="block text-[12.5px] font-semibold text-tinta-2">Dirección
        <select value={valor("dir")} onChange={(e) => cambiar("dir", e.target.value)} className={campo + (valor("dir") ? " border-verde/60" : " border-linea")}>
          <option value="">Todos</option>
          <option value="entrante">Los que llegan</option>
          <option value="saliente">Los que envía el agente</option>
        </select>
      </label>
      <button type="button" disabled={!activos} onClick={() => empezar(() => router.push("/buzon", { scroll: false }))} className="h-10 rounded-ctl px-3 font-display text-[13px] font-semibold text-verde-profundo hover:bg-verde-suave disabled:pointer-events-none disabled:opacity-40">
        Limpiar
      </button>
    </div>
  );
}
