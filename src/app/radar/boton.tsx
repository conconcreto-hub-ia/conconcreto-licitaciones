"use client";

import { useState, useTransition } from "react";
import { Boton } from "@/components/ui";
import { IconoRadar } from "@/components/iconos";
import { correrRadarAhora } from "@/app/acciones";

export function BotonRadar() {
  const [pendiente, empezar] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <Boton
        variante="primario"
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            const r = await correrRadarAhora();
            setResultado(r.error ? `Falló: ${r.error}` : `${r.revisados} revisados · ${r.nuevos} nuevas · ${r.creditos} créditos`);
          })
        }
      >
        <IconoRadar className={pendiente ? "size-4 animate-spin" : "size-4"} />
        {pendiente ? "Leyendo el SECOP y armando fichas…" : "Correr el radar ahora"}
      </Boton>
      {resultado && <span className="text-[13px] text-white/75">{resultado}</span>}
    </div>
  );
}
