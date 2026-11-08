"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton, Cifra, Insignia, SeccionEt, Tarjeta, Vacio } from "./ui";
import { IconoPaquete, IconoDocumento, IconoAlerta, IconoCheck } from "./iconos";
import { proponerPaquetesAhora, confirmarPaquetesAhora } from "@/app/acciones";

export type PaqueteVista = {
  id: string;
  nombre: string;
  tipo: "suministro" | "servicio" | "mano_de_obra";
  estado: "propuesto" | "confirmado";
  porque: string | null;
  lineas: { id: string; codigo: string | null; descripcion: string; unidad: string | null; cantidad: number | null; compartida: boolean }[];
  archivoId: string | null;
};

const TIPO = { suministro: "Suministro", servicio: "Servicio", mano_de_obra: "Mano de obra" } as const;

export function Paquetes(props: { oportunidadId: string; tieneFormulario: boolean; actividades: number; paquetes: PaqueteVista[]; controlId: string | null }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const correr = (fn: () => Promise<unknown>) => empezar(async () => { setError(null); try { await fn(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } });

  const confirmados = props.paquetes.length > 0 && props.paquetes.every((p) => p.estado === "confirmado");
  const porAsignar = props.paquetes.find((p) => p.nombre === "Por asignar");
  const compartidas = new Set(props.paquetes.flatMap((p) => p.lineas.filter((l) => l.compartida).map((l) => l.id))).size;

  if (!props.tieneFormulario) {
    return (
      <section className="space-y-3">
        <SeccionEt>Paquetes de cotización</SeccionEt>
        <Vacio icono={<IconoDocumento className="size-5" />} titulo="Falta el formulario de cantidades">
          Reenvía al buzón del agente el Excel de cantidades del cliente, con el código de la oportunidad en el asunto. Con ese archivo el agente arma los paquetes.
        </Vacio>
      </section>
    );
  }

  if (props.paquetes.length === 0) {
    return (
      <section className="space-y-3">
        <SeccionEt>Paquetes de cotización</SeccionEt>
        <Vacio
          icono={<IconoPaquete className="size-5" />}
          titulo="Listo para armar los paquetes"
          accion={<Boton variante="primario" disabled={pendiente} onClick={() => correr(() => proponerPaquetesAhora(props.oportunidadId))}>{pendiente ? "Leyendo el formulario y agrupando…" : "Proponer paquetes"}</Boton>}
        >
          El agente lee el formulario de cantidades y agrupa las actividades según qué proveedor las cotiza. Ninguna queda por fuera, y tú confirmas antes de que salga nada.
        </Vacio>
        {error && <p className="text-[13.5px] text-rojo">{error}</p>}
      </section>
    );
  }

  const grupos = (["suministro", "servicio", "mano_de_obra"] as const).map((t) => ({ tipo: t, paquetes: props.paquetes.filter((p) => p.tipo === t) })).filter((g) => g.paquetes.length);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SeccionEt>Paquetes de cotización</SeccionEt>
          <div className="mt-2 flex items-center gap-2">
            {confirmados ? <Insignia tono="verde"><IconoCheck className="size-3.5" />Confirmados</Insignia> : <Insignia tono="oro">Propuesta del agente · falta confirmar</Insignia>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!confirmados && <Boton chico variante="fantasma" disabled={pendiente} onClick={() => correr(() => proponerPaquetesAhora(props.oportunidadId))}>Volver a proponer</Boton>}
          {!confirmados && <Boton chico variante="primario" disabled={pendiente || !!porAsignar} onClick={() => correr(() => confirmarPaquetesAhora(props.oportunidadId))}>{pendiente ? "Trabajando…" : "Confirmar y generar BIMBAU"}</Boton>}
          {confirmados && props.controlId && <a href={`/api/archivos/${props.controlId}`} className="inline-flex h-8 items-center gap-2 rounded-ctl border border-linea bg-papel px-3 font-display text-[13px] font-semibold hover:bg-fondo"><IconoDocumento />Control de asignación</a>}
        </div>
      </div>

      <Tarjeta className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-4">
        <Cifra valor={props.actividades} rotulo="Actividades del formulario" />
        <Cifra valor={props.paquetes.length} rotulo="Paquetes" />
        <Cifra valor={compartidas} rotulo="En dos paquetes" nota="se cotizan con dos tipos de proveedor" />
        <Cifra valor={porAsignar ? porAsignar.lineas.length : 0} rotulo="Sin asignar" nota={porAsignar ? "hay que ubicarlas antes de confirmar" : "todas tienen paquete"} />
      </Tarjeta>

      {porAsignar && <p className="flex items-center gap-2 text-[13.5px] text-rojo"><IconoAlerta />Hay actividades que el agente no supo ubicar. Vuelve a proponer o ajústalas antes de confirmar.</p>}
      {error && <p className="text-[13.5px] text-rojo">{error}</p>}

      {grupos.map((g) => (
        <div key={g.tipo} className="space-y-2">
          <h3 className="pt-2 text-[15px] font-bold text-tinta-2">{TIPO[g.tipo]} · {g.paquetes.length}</h3>
          <div className="grid items-start gap-3 md:grid-cols-2">
            {g.paquetes.map((p) => (
              <Tarjeta key={p.id} className="p-0">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <h4 className="font-display text-[15px] font-bold leading-snug">{p.nombre}</h4>
                      {p.porque && <p className="mt-1 text-[13px] text-tinta-2">{p.porque}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-linea-2 px-2 py-0.5 font-display text-[12px] font-bold text-tinta-2">{p.lineas.length}</span>
                  </summary>
                  <div className="border-t border-linea-2 px-4 pb-4 pt-2">
                    <table className="w-full text-[12.5px]">
                      <tbody>
                        {p.lineas.map((l) => (
                          <tr key={l.id} className="align-top">
                            <td className="w-12 py-1 font-mono text-tinta-3">{l.codigo}</td>
                            <td className="py-1 pr-2">{l.descripcion}{l.compartida && <span className="ml-1.5 text-[11px] font-semibold text-[#8a5a00]">· compartida</span>}</td>
                            <td className="tabular whitespace-nowrap py-1 text-right text-tinta-2">{l.cantidad?.toLocaleString("es-CO")} {l.unidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {p.archivoId && <a href={`/api/archivos/${p.archivoId}`} className="mt-3 inline-flex items-center gap-1.5 font-display text-[13px] font-semibold text-verde-profundo hover:underline"><IconoDocumento />Descargar BIMBAU</a>}
                  </div>
                </details>
              </Tarjeta>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
