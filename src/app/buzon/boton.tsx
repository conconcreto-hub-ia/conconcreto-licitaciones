"use client";

import { useState, useTransition } from "react";
import { Boton } from "@/components/ui";
import { IconoCorreo } from "@/components/iconos";
import { revisarBuzonAhora } from "@/app/acciones";

export function BotonBuzon() {
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <Boton
        variante="primario"
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            try {
              const r = await revisarBuzonAhora();
              setResultado(r.nuevos === 0 ? "No hay correos nuevos" : `${r.nuevos} nuevos · ${r.oportunidades} invitaciones · ${r.pliegos} con pliegos · ${r.ignorados} sin autorizar`);
            } catch (e) {
              setResultado(`Falló: ${e instanceof Error ? e.message : e}`);
            }
          })
        }
      >
        <IconoCorreo className={pendiente ? "size-4 animate-pulse" : "size-4"} />
        {pendiente ? "Leyendo el buzón…" : "Revisar el buzón ahora"}
      </Boton>
      {resultado && <span className="text-[13px] text-white/75">{resultado}</span>}
    </div>
  );
}
