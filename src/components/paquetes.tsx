"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton, Cifra, Insignia, SeccionEt, Tarjeta, Vacio } from "./ui";
import { IconoPaquete, IconoDocumento, IconoAlerta, IconoCheck, IconoFlecha } from "./iconos";
import { proponerPaquetesAhora, confirmarPaquetesAhora, moverActividadAhora } from "@/app/acciones";

export type PaqueteVista = {
  id: string;
  nombre: string;
  tipo: "suministro" | "servicio" | "mano_de_obra";
  estado: "propuesto" | "confirmado";
  porque: string | null;
  lineas: { id: string; codigo: string | null; descripcion: string; unidad: string | null; cantidad: number | null; compartida: boolean }[];
  archivoId: string | null;
  /** Si es un suministro que se consolida: lo que sale en el BIMBAU y lo que no se pudo calcular. */
  consolidado: { lineas: { descripcion: string; unidad: string; cantidad: number; nFuentes: number }[]; pendientes: { codigo: string | null; descripcion: string; motivo: string }[] } | null;
};

const TIPO = { suministro: "Suministro", servicio: "Servicio", mano_de_obra: "Mano de obra" } as const;

export function Paquetes(props: { puedeEditar: boolean; oportunidadId: string; tieneFormulario: boolean; actividades: number; paquetes: PaqueteVista[]; controlId: string | null }) {
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
          accion={!props.puedeEditar ? undefined : <Boton variante="primario" disabled={pendiente} onClick={() => correr(() => proponerPaquetesAhora(props.oportunidadId))}>{pendiente ? "Leyendo el formulario y agrupando…" : "Proponer paquetes"}</Boton>}
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
          {!confirmados && props.puedeEditar && <Boton chico variante="fantasma" disabled={pendiente} onClick={() => correr(() => proponerPaquetesAhora(props.oportunidadId))}>Volver a proponer</Boton>}
          {!confirmados && props.puedeEditar && <Boton chico variante="primario" disabled={pendiente || !!porAsignar} onClick={() => correr(() => confirmarPaquetesAhora(props.oportunidadId))}>{pendiente ? "Trabajando…" : "Confirmar y generar BIMBAU"}</Boton>}
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
                            {!confirmados && props.puedeEditar && (
                              <td className="w-8 py-1 pl-1">
                                <span className="relative grid size-6 place-items-center rounded-ctl border border-linea bg-papel text-tinta-3 hover:border-verde hover:text-verde-profundo">
                                  <IconoFlecha className="pointer-events-none size-3.5" />
                                  <select
                                    aria-label="Mover a otro paquete"
                                    title="Mover a otro paquete"
                                    disabled={pendiente}
                                    value=""
                                    onChange={(e) => { const hacia = e.target.value; if (hacia) correr(() => moverActividadAhora(props.oportunidadId, l.id, p.id, hacia)); }}
                                    className="absolute inset-0 cursor-pointer opacity-0"
                                  >
                                    <option value="">Mover a…</option>
                                    {props.paquetes.filter((x) => x.id !== p.id).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                                  </select>
                                </span>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {p.consolidado && (
                      <div className="mt-3 rounded-ctl border border-linea bg-fondo p-3">
                        <div className="font-display text-[11.5px] font-bold uppercase tracking-[.08em] text-verde-profundo">Lo que sale en el BIMBAU · consolidado</div>
                        <table className="mt-1.5 w-full text-[12.5px]">
                          <tbody>
                            {p.consolidado.lineas.map((l) => (
                              <tr key={l.descripcion}><td className="py-0.5 pr-2 font-semibold">{l.descripcion}</td><td className="tabular whitespace-nowrap py-0.5 text-right font-semibold">{l.cantidad.toLocaleString("es-CO")} {l.unidad}</td></tr>
                            ))}
                          </tbody>
                        </table>
                        {p.consolidado.pendientes.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-linea pt-2">
                            {p.consolidado.pendientes.map((x, i) => <p key={i} className="flex gap-1.5 text-[12px] text-rojo"><IconoAlerta className="mt-0.5 size-3.5" /><span><b className="font-semibold">{x.codigo} {x.descripcion}:</b> {x.motivo} Va transcrita tal cual.</span></p>)}
                          </div>
                        )}
                      </div>
                    )}
                    {p.archivoId && (
                      <div className="mt-3 flex flex-wrap gap-4">
                        <a href={`/paquetes/${p.id}`} className="inline-flex items-center gap-1.5 font-display text-[13px] font-semibold text-verde-profundo hover:underline">Proveedores y cotizaciones →</a>
                        <a href={`/api/archivos/${p.archivoId}`} className="inline-flex items-center gap-1.5 font-display text-[13px] font-semibold text-tinta-2 hover:underline"><IconoDocumento />BIMBAU</a>
                      </div>
                    )}
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
