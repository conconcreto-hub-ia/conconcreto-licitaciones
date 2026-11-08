import { notFound } from "next/navigation";
import Link from "next/link";
import { Barra } from "@/components/barra";
import { Aja, Boton, Chip, Cifra, Contenedor, Dato, Encaje, Insignia, SeccionEt, Tarjeta, Vacio } from "@/components/ui";
import { IconoAlerta, IconoComite, IconoExterno, IconoFlecha, IconoTendencia, IconoEdificio, IconoCheck } from "@/components/iconos";
import { Bitacora, tituloDe } from "@/components/oportunidad";
import { db } from "@/lib/db";
import { ESTADO_OPORTUNIDAD, RECOMENDACION, ORIGEN } from "@/lib/etiquetas";
import { cierre, cop, copCorto, fecha, fechaHora } from "@/lib/formato";
import type { Ficha } from "@/lib/ficha";
import { rehacerFicha } from "@/app/acciones";
import { FormComite } from "@/components/comite";
import { Paquetes, type PaqueteVista } from "@/components/paquetes";
import { lineasDePaquete } from "@/lib/paquetes";

export const dynamic = "force-dynamic";

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${(x * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`);

export default async function FichaOportunidad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await db.oportunidad.findUnique({ where: { id }, include: { eventos: { orderBy: { createdAt: "desc" } }, criterio: true } });
  if (!o) notFound();

  const f = o.ficha as Ficha | null;
  const rec = o.recomendacion ? RECOMENDACION[o.recomendacion] : null;
  const est = ESTADO_OPORTUNIDAD[o.estado];
  const decidida = ["aprobada", "descartada", "en_cotizacion", "cerrada"].includes(o.estado);
  const enCotizacion = ["aprobada", "en_cotizacion"].includes(o.estado);
  const [paquetesDb, archivos, formularios, nActividades] = enCotizacion
    ? await Promise.all([
        db.paquete.findMany({ where: { oportunidadId: o.id }, include: { lineas: { include: { actividad: { include: { _count: { select: { paquetes: true } } } } } } }, orderBy: { nombre: "asc" } }),
        db.archivo.findMany({ where: { oportunidadId: o.id }, select: { id: true, tipo: true, paqueteId: true } }),
        db.documento.count({ where: { oportunidadId: o.id, tipo: "formulario" } }),
        db.actividad.count({ where: { oportunidadId: o.id, esCapitulo: false } }),
      ])
    : [[], [], 0, 0] as const;
  const paquetes: PaqueteVista[] = paquetesDb.map((p) => ({
    id: p.id, nombre: p.nombre, tipo: p.tipo, estado: p.estado, porque: p.porque,
    archivoId: archivos.find((a) => a.paqueteId === p.id)?.id ?? null,
    lineas: p.lineas.map((l) => l.actividad).sort((a, b) => a.orden - b.orden).map((a) => ({ id: a.id, codigo: a.codigo, descripcion: a.descripcion, unidad: a.unidad, cantidad: a.cantidad, compartida: a._count.paquetes > 1 })),
    consolidado: (() => {
      const c = lineasDePaquete(p, p.lineas.map((l) => l.actividad)).consolidacion;
      return c ? { lineas: c.lineas.map((l) => ({ descripcion: l.descripcion, unidad: l.unidad, cantidad: l.cantidad, nFuentes: l.fuentes.length })), pendientes: c.pendientes.map((x) => ({ codigo: x.codigo, descripcion: x.descripcion, motivo: x.motivo })) } : null;
    })(),
  }));

  return (
    <>
      <Barra>
        <Contenedor className="pb-10 pt-7">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/60 hover:text-white">
            <IconoFlecha className="size-3.5 rotate-180" /> Oportunidades
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-display text-[12px] font-bold uppercase tracking-[.1em] text-oro">{ORIGEN[o.origen].etiqueta}</span>
            <span className="font-mono text-[12.5px] text-white/50">{o.codigo}</span>
            <Insignia tono={est.tono === "noche" ? "neutro" : est.tono}>{est.etiqueta}</Insignia>
          </div>
          <h1 className="mt-3 max-w-[900px] text-[30px] font-extrabold leading-[1.1] text-white sm:text-[38px]">{tituloDe(o)}</h1>
          <p className="mt-2 text-[15px] text-white/70">{o.entidad}{o.municipio ? ` · ${o.municipio}` : ""}{o.departamento ? `, ${o.departamento}` : ""}</p>
          <div className="mt-7 flex flex-wrap gap-x-12 gap-y-6">
            <Cifra oscuro valor={copCorto(o.valorEstimado)} rotulo={o.origen === "secop" ? "Presupuesto oficial" : "Presupuesto de referencia del cliente"} nota={cop(o.valorEstimado)} />
            <Cifra oscuro valor={o.fechaCierre ? fecha(o.fechaCierre) : "—"} rotulo={cierre(o.fechaCierre)} />
            {f?.mercado && <Cifra oscuro valor={pct(f.mercado.entidad.descuentoMediano)} rotulo="Descuento con que se gana" nota={`mediana de ${f.mercado.entidad.obrasAdjudicadas} obras de la entidad`} />}
            {f?.mercado && <Cifra oscuro valor={f.mercado.entidad.oferentesPromedio?.toLocaleString("es-CO") ?? "—"} rotulo="Oferentes en promedio" nota="en las obras de esta entidad" />}
          </div>
        </Contenedor>
      </Barra>

      <Contenedor className="grid gap-8 py-9 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          {enCotizacion && (
            <Paquetes oportunidadId={o.id} tieneFormulario={formularios > 0} actividades={nActividades} paquetes={paquetes} controlId={archivos.find((a) => a.tipo === "control")?.id ?? null} />
          )}
          {!f ? (
            <Vacio icono={<IconoComite className="size-5" />} titulo="Todavía no tiene ficha" accion={
              <form action={rehacerFicha}><input type="hidden" name="id" value={o.id} /><Boton variante="primario" type="submit">Armar la ficha</Boton></form>
            }>El agente lee el mercado en el SECOP y prepara la recomendación para el comité.</Vacio>
          ) : (
            <>
              {/* La recomendación */}
              <Tarjeta className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <SeccionEt>Recomendación del agente</SeccionEt>
                    <div className="mt-3 flex items-center gap-3">
                      {rec && <Insignia tono={rec.tono} punto>{rec.etiqueta}</Insignia>}
                      <Encaje valor={f.encaje} ancho="w-32" />
                    </div>
                  </div>
                  <form action={rehacerFicha}><input type="hidden" name="id" value={o.id} /><Boton chico variante="fantasma" type="submit">Rehacer ficha</Boton></form>
                </div>
                <p className="mt-4 text-[16px] leading-relaxed text-tinta">{f.resumen}</p>
              </Tarjeta>

              <Aja>{f.hallazgo}</Aja>

              {/* Razones */}
              <section className="space-y-3">
                <SeccionEt>Por qué</SeccionEt>
                <div className="grid gap-3 sm:grid-cols-2">
                  {f.razones.map((r, i) => (
                    <Tarjeta key={i} className="p-5">
                      <h3 className="text-[15.5px] font-bold">{r.titulo}</h3>
                      <p className="mt-1.5 text-[14px] text-tinta-2">{r.detalle}</p>
                    </Tarjeta>
                  ))}
                </div>
              </section>

              {/* Riesgos y preguntas */}
              <div className="grid gap-4 md:grid-cols-2">
                <Tarjeta className="p-5">
                  <div className="flex items-center gap-2 text-rojo"><IconoAlerta /><h3 className="text-[15.5px] font-bold text-tinta">Riesgos</h3></div>
                  <ul className="mt-3 space-y-2.5 pl-0">
                    {f.riesgos.map((r, i) => <li key={i} className="list-none border-l-2 border-rojo/40 pl-3 text-[14px] text-tinta-2">{r}</li>)}
                  </ul>
                </Tarjeta>
                <Tarjeta className="p-5">
                  <div className="flex items-center gap-2 text-verde-profundo"><IconoComite /><h3 className="text-[15.5px] font-bold text-tinta">Lo que el comité tiene que resolver</h3></div>
                  <ol className="mt-3 space-y-2.5 pl-0">
                    {f.preguntas_comite.map((p, i) => (
                      <li key={i} className="flex list-none gap-2.5 text-[14px] text-tinta-2">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-verde-suave font-display text-[11px] font-bold text-verde-profundo">{i + 1}</span>{p}
                      </li>
                    ))}
                  </ol>
                </Tarjeta>
              </div>

              {/* Lo que trajo la invitación */}
              {(f.recibidos?.length || f.faltantes?.length) ? (
                <section className="space-y-3">
                  <SeccionEt>Documentos de la invitación</SeccionEt>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Tarjeta className="p-5">
                      <h3 className="text-[15.5px] font-bold">Llegaron</h3>
                      <ul className="mt-3 space-y-2 pl-0">{(f.recibidos ?? []).map((d, i) => <li key={i} className="flex list-none gap-2 text-[14px] text-tinta-2"><IconoCheck className="mt-0.5 text-verde" />{d}</li>)}</ul>
                    </Tarjeta>
                    <Tarjeta className="p-5">
                      <h3 className="text-[15.5px] font-bold">Faltan para cotizar</h3>
                      {(f.faltantes ?? []).length === 0 ? <p className="mt-3 text-[14px] text-tinta-3">No falta nada.</p> : (
                        <ul className="mt-3 space-y-2 pl-0">{(f.faltantes ?? []).map((d, i) => <li key={i} className="flex list-none gap-2 text-[14px] text-tinta-2"><IconoAlerta className="mt-0.5 text-rojo" />{d}</li>)}</ul>
                      )}
                    </Tarjeta>
                  </div>
                </section>
              ) : null}

              {/* El mercado */}
              {f.mercado && <section className="space-y-3">
                <SeccionEt>El mercado de esta entidad</SeccionEt>
                <Tarjeta className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-linea px-5 py-3.5"><IconoTendencia className="text-verde-profundo" /><h3 className="text-[15px] font-bold">Quién le gana obras a {o.entidad.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}</h3></div>
                  {f.mercado.entidad.ganadores.length === 0 ? <p className="px-5 py-4 text-[14px] text-tinta-3">El SECOP no registra adjudicaciones de esta entidad.</p> : (
                    <table className="w-full text-[14px]">
                      <thead><tr className="text-left text-[12px] text-tinta-3"><th className="px-5 py-2 font-medium">Contratista</th><th className="px-3 py-2 text-right font-medium">Contratos</th><th className="px-5 py-2 text-right font-medium">Valor adjudicado</th></tr></thead>
                      <tbody>
                        {f.mercado.entidad.ganadores.map((g) => (
                          <tr key={g.nombre} className="border-t border-linea-2"><td className="px-5 py-2.5">{g.nombre}</td><td className="tabular px-3 py-2.5 text-right">{g.veces}</td><td className="tabular px-5 py-2.5 text-right">{cop(g.valor)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Tarjeta>
                <Tarjeta className="p-5">
                  <div className="flex items-center gap-2"><IconoEdificio className="text-verde-profundo" /><h3 className="text-[15px] font-bold">Conconcreto en el SECOP</h3></div>
                  <dl className="m-0 mt-2">
                    <Dato k="Adjudicaciones">{f.mercado.conconcreto.adjudicaciones} · {cop(f.mercado.conconcreto.valorAdjudicado)}</Dato>
                    <Dato k="Con esta entidad">{f.mercado.conconcreto.conEstaEntidad.veces ? `${f.mercado.conconcreto.conEstaEntidad.veces} · ${cop(f.mercado.conconcreto.conEstaEntidad.valor)}` : "Nunca le ha contratado"}</Dato>
                    <Dato k="Mayores contratos">{f.mercado.conconcreto.mayores.map((m) => `${m.entidad.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())} (${copCorto(m.valor)})`).join(" · ")}</Dato>
                  </dl>
                </Tarjeta>
              </section>}
            </>
          )}
        </div>

        {/* Columna del comité */}
        <aside className="space-y-5">
          <Tarjeta className="p-5">
            <SeccionEt>Comité</SeccionEt>
            {decidida ? (
              <div className="mt-3">
                <div className="flex items-center gap-2">{o.estado === "descartada" ? <Insignia tono="neutro">Descartada</Insignia> : <Insignia tono="verde"><IconoCheck className="size-3.5" />Aprobada</Insignia>}</div>
                {o.decision && <p className="mt-3 text-[14px] text-tinta-2">«{o.decision}»</p>}
                {o.decididoEn && <p className="mt-2 text-[12.5px] text-tinta-3">{o.decididoPor} · {fechaHora(o.decididoEn)}</p>}
              </div>
            ) : (
              <FormComite id={o.id} ayuda={o.origen === "secop" ? "Al aprobar, el siguiente paso es reenviar los pliegos del SECOP al buzón del agente, con el código del proceso en el asunto." : "Al aprobar, el siguiente paso es armar los paquetes de cotización con los documentos que llegaron."} />
            )}
          </Tarjeta>

          <Tarjeta className="p-5">
            <SeccionEt>El proceso</SeccionEt>
            <dl className="m-0 mt-2">
              <Dato k="Modalidad">{o.modalidad ?? "—"}</Dato>
              <Dato k="Tipología">{o.tipologia ?? "—"}</Dato>
              <Dato k="Publicado">{fecha(o.fechaPublicacion)}</Dato>
              {o.criterio && <Dato k="Criterio">{o.criterio.nombre}</Dato>}
            </dl>
            {o.objeto && <p className="mt-3 text-[13.5px] leading-relaxed text-tinta-2">{o.objeto}</p>}
            {o.urlFuente && (
              <a href={o.urlFuente} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 font-display text-[13.5px] font-semibold text-verde-profundo hover:underline">
                Ver en el SECOP <IconoExterno className="size-3.5" />
              </a>
            )}
          </Tarjeta>

          <Tarjeta className="p-5">
            <SeccionEt>Bitácora</SeccionEt>
            <div className="mt-4"><Bitacora eventos={o.eventos} /></div>
          </Tarjeta>
          {f && <div className="flex flex-wrap gap-2"><Chip>Ficha: {f.modelo}</Chip>{f.mercado && <Chip>{f.mercado.creditos} créditos de Croma</Chip>}</div>}
        </aside>
      </Contenedor>
    </>
  );
}
