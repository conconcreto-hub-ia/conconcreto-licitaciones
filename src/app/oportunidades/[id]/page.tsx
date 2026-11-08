import { notFound } from "next/navigation";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/permisos";
import Link from "next/link";
import type { ReactNode } from "react";
import { Barra } from "@/components/barra";
import { Aja, Boton, Chip, Contenedor, Insignia, SeccionEt, Tarjeta, Vacio } from "@/components/ui";
import { IconoAlerta, IconoComite, IconoExterno, IconoFlecha, IconoTendencia, IconoEdificio, IconoCheck, IconoMapa, IconoReloj } from "@/components/iconos";
import { Bitacora, tituloDe } from "@/components/oportunidad";
import { db } from "@/lib/db";
import { ESTADO_OPORTUNIDAD, RECOMENDACION, ORIGEN } from "@/lib/etiquetas";
import { cierre, cop, copCorto, diasHasta, fecha, fechaHora, nombrePropio } from "@/lib/formato";
import type { Ficha } from "@/lib/ficha";
import { rehacerFicha } from "@/app/acciones";
import { FormComite } from "@/components/comite";
import { Paquetes, type PaqueteVista } from "@/components/paquetes";
import { lineasDePaquete } from "@/lib/paquetes";

export const dynamic = "force-dynamic";

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${(x * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`);

export default async function FichaOportunidad({ params }: { params: Promise<{ id: string }> }) {
  const yo = await exigirSesion();
  const { id } = await params;
  const o = await db.oportunidad.findUnique({ where: { id }, include: { eventos: { orderBy: { createdAt: "desc" } }, criterio: true } });
  if (!o) notFound();

  const f = o.ficha as Ficha | null;
  const rec = o.recomendacion ? RECOMENDACION[o.recomendacion] : null;
  const est = ESTADO_OPORTUNIDAD[o.estado];
  const decidida = ["aprobada", "descartada", "en_cotizacion", "cerrada"].includes(o.estado);
  const enCotizacion = ["aprobada", "en_cotizacion"].includes(o.estado);
  const dias = diasHasta(o.fechaCierre);
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
  const ganadores = f?.mercado?.entidad.ganadores ?? [];
  const maxGanado = Math.max(1, ...ganadores.map((g) => Number(g.valor) || 0));

  return (
    <>
      <Barra>
        <Contenedor className="pb-8 pt-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/55 transition-colors hover:text-white">
            <IconoFlecha className="size-3.5 rotate-180" /> Oportunidades
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full border border-oro/40 bg-oro/10 px-2.5 font-display text-[11.5px] font-bold uppercase tracking-[.1em] text-oro">{ORIGEN[o.origen].etiqueta}</span>
            <span className="font-mono text-[12.5px] text-white/45">{o.codigo}</span>
            <Insignia tono={est.tono === "noche" ? "neutro" : est.tono}>{est.etiqueta}</Insignia>
          </div>
          <h1 className="mt-3 max-w-[920px] text-[28px] font-extrabold leading-[1.1] text-white sm:text-[36px]">{tituloDe(o)}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[14.5px] text-white/65">
            <IconoEdificio className="size-4 text-white/40" />{nombrePropio(o.entidad)}
            {(o.municipio || o.departamento) && <><span className="text-white/25">·</span><IconoMapa className="size-4 text-white/40" />{[o.municipio, o.departamento].filter(Boolean).join(", ")}</>}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CifraHero valor={copCorto(o.valorEstimado)} rotulo={o.origen === "secop" ? "Presupuesto oficial" : "Presupuesto de referencia"} nota={cop(o.valorEstimado)} />
            <CifraHero valor={o.fechaCierre ? fecha(o.fechaCierre) : "—"} rotulo="Cierre" nota={cierre(o.fechaCierre)} alerta={dias !== null && dias >= 0 && dias <= 7} />
            {f?.mercado && <CifraHero valor={pct(f.mercado.entidad.descuentoMediano)} rotulo="Descuento con que se gana" nota={`mediana de ${f.mercado.entidad.obrasAdjudicadas} obras de la entidad`} />}
            {f?.mercado && <CifraHero valor={f.mercado.entidad.oferentesPromedio?.toLocaleString("es-CO") ?? "—"} rotulo="Oferentes en promedio" nota="en las obras de esta entidad" />}
          </div>
        </Contenedor>
      </Barra>

      <Contenedor className="grid gap-7 py-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-7">
          {enCotizacion && (
            <Paquetes puedeEditar={puede(yo.rol, "paquetes.editar")} oportunidadId={o.id} tieneFormulario={formularios > 0} actividades={nActividades} paquetes={paquetes} controlId={archivos.find((a) => a.tipo === "control")?.id ?? null} />
          )}
          {!f ? (
            <Vacio icono={<IconoComite className="size-5" />} titulo="Todavía no tiene ficha" accion={!puede(yo.rol, "ficha.rehacer") ? undefined :
              <form action={rehacerFicha}><input type="hidden" name="id" value={o.id} /><Boton variante="primario" type="submit">Armar la ficha</Boton></form>
            }>El agente lee el mercado en el SECOP y prepara la recomendación para el comité.</Vacio>
          ) : (
            <>
              {/* El veredicto */}
              <Tarjeta className="overflow-hidden">
                <div className="grid gap-6 p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                  <Medidor valor={f.encaje} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <SeccionEt>Recomendación del agente</SeccionEt>
                      {puede(yo.rol, "ficha.rehacer") && <form action={rehacerFicha}><input type="hidden" name="id" value={o.id} /><Boton chico variante="fantasma" type="submit">Rehacer ficha</Boton></form>}
                    </div>
                    {rec && <div className="mt-3"><Veredicto tono={rec.tono}>{rec.etiqueta}</Veredicto></div>}
                    <p className="mt-3 text-[15.5px] leading-relaxed text-tinta">{f.resumen}</p>
                  </div>
                </div>
              </Tarjeta>

              <Aja>{f.hallazgo}</Aja>

              {/* Razones */}
              <section className="space-y-3">
                <SeccionEt>Por qué</SeccionEt>
                <div className="grid gap-3 sm:grid-cols-2">
                  {f.razones.map((r, i) => (
                    <Tarjeta key={i} viva className="p-5">
                      <div className="flex items-start gap-3.5">
                        <span className="num mt-0.5 text-[22px] font-extrabold leading-none text-oro/80">{String(i + 1).padStart(2, "0")}</span>
                        <div className="min-w-0">
                          <h3 className="text-[15.5px] font-bold leading-snug">{r.titulo}</h3>
                          <p className="mt-1.5 text-[14px] leading-relaxed text-tinta-2">{r.detalle}</p>
                        </div>
                      </div>
                    </Tarjeta>
                  ))}
                </div>
              </section>

              {/* Riesgos y preguntas */}
              <div className="grid gap-4 md:grid-cols-2">
                <Tarjeta className="p-5">
                  <TituloBloque icono={<IconoAlerta />} tono="rojo">Riesgos</TituloBloque>
                  <ul className="mt-4 space-y-3 pl-0">
                    {f.riesgos.map((r, i) => (
                      <li key={i} className="flex list-none gap-2.5 text-[14px] leading-relaxed text-tinta-2">
                        <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-rojo" />{r}
                      </li>
                    ))}
                  </ul>
                </Tarjeta>
                <Tarjeta className="p-5">
                  <TituloBloque icono={<IconoComite />} tono="verde">Lo que el comité tiene que resolver</TituloBloque>
                  <ol className="mt-4 space-y-3 pl-0">
                    {f.preguntas_comite.map((p, i) => (
                      <li key={i} className="flex list-none gap-2.5 text-[14px] leading-relaxed text-tinta-2">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-verde-suave font-display text-[11px] font-bold text-verde-profundo">{i + 1}</span>{p}
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
                      <TituloBloque icono={<IconoCheck />} tono="verde">Llegaron</TituloBloque>
                      <ul className="mt-3 space-y-2 pl-0">{(f.recibidos ?? []).map((d, i) => <li key={i} className="flex list-none gap-2 text-[14px] text-tinta-2"><IconoCheck className="mt-0.5 text-verde" />{d}</li>)}</ul>
                    </Tarjeta>
                    <Tarjeta className="p-5">
                      <TituloBloque icono={<IconoAlerta />} tono="rojo">Faltan para cotizar</TituloBloque>
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
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linea px-5 py-4">
                    <TituloBloque icono={<IconoTendencia />} tono="verde">Quién le gana obras a {nombrePropio(o.entidad)}</TituloBloque>
                    <span className="text-[12.5px] text-tinta-3">{f.mercado.entidad.obrasAdjudicadas} obras adjudicadas</span>
                  </div>
                  {ganadores.length === 0 ? <p className="px-5 py-4 text-[14px] text-tinta-3">El SECOP no registra adjudicaciones de esta entidad.</p> : (
                    <ul className="divide-y divide-linea-2 pl-0">
                      {ganadores.map((g, i) => (
                        <li key={g.nombre} className="grid list-none grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
                          <span className="num text-[13px] font-bold text-tinta-3">{i + 1}</span>
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold">{nombrePropio(g.nombre)}</div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-linea-2">
                              <div className="h-full rounded-full [background:var(--degradado)]" style={{ width: `${Math.max(4, (Number(g.valor) / maxGanado) * 100)}%` }} />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="tabular text-[14px] font-semibold">{copCorto(g.valor)}</div>
                            <div className="text-[12px] text-tinta-3">{g.veces} {g.veces === 1 ? "contrato" : "contratos"}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>
                <Tarjeta className="p-5">
                  <TituloBloque icono={<IconoEdificio />} tono="verde">Conconcreto en el SECOP</TituloBloque>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <MiniCifra rotulo="Adjudicaciones" valor={`${f.mercado.conconcreto.adjudicaciones}`} nota={cop(f.mercado.conconcreto.valorAdjudicado)} />
                    <MiniCifra rotulo="Con esta entidad" valor={f.mercado.conconcreto.conEstaEntidad.veces ? `${f.mercado.conconcreto.conEstaEntidad.veces}` : "Ninguna"} nota={f.mercado.conconcreto.conEstaEntidad.veces ? cop(f.mercado.conconcreto.conEstaEntidad.valor) : "Nunca le ha contratado"} />
                  </div>
                  {f.mercado.conconcreto.mayores.length > 0 && (
                    <div className="mt-4">
                      <div className="text-[12.5px] font-semibold text-tinta-3">Sus mayores contratos</div>
                      <div className="mt-2 flex flex-wrap gap-2">{f.mercado.conconcreto.mayores.map((m, i) => <Chip key={i}>{nombrePropio(m.entidad)} · {copCorto(m.valor)}</Chip>)}</div>
                    </div>
                  )}
                </Tarjeta>
              </section>}
            </>
          )}
        </div>

        {/* Columna del comité */}
        <aside className="space-y-5">
          <Tarjeta className={decidida ? "p-5" : "border-oro/50 p-5 ring-4 ring-oro/10"}>
            <div className="flex items-center justify-between">
              <SeccionEt>Comité</SeccionEt>
              {!decidida && <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8a5a00]"><IconoReloj className="size-3.5" />{cierre(o.fechaCierre)}</span>}
            </div>
            {decidida ? (
              <div className="mt-3">
                <div className="flex items-center gap-2">{o.estado === "descartada" ? <Insignia tono="neutro">Descartada</Insignia> : <Insignia tono="verde"><IconoCheck className="size-3.5" />Aprobada</Insignia>}</div>
                {o.decision && <p className="mt-3 text-[14px] text-tinta-2">«{o.decision}»</p>}
                {o.decididoEn && <p className="mt-2 text-[12.5px] text-tinta-3">{o.decididoPor} · {fechaHora(o.decididoEn)}</p>}
              </div>
            ) : (
              !puede(yo.rol, "comite.decidir") ? <p className="mt-3 text-[13.5px] text-tinta-2">La decisión la toma el comité. Tu rol puede ver la ficha, no decidir.</p> : <FormComite id={o.id} ayuda={o.origen === "secop" ? "Al aprobar, el siguiente paso es reenviar los pliegos del SECOP al buzón del agente, con el código del proceso en el asunto." : "Al aprobar, el siguiente paso es armar los paquetes de cotización con los documentos que llegaron."} />
            )}
          </Tarjeta>

          <Tarjeta className="p-5">
            <SeccionEt>El proceso</SeccionEt>
            <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <DatoCorto k="Modalidad">{o.modalidad ?? "—"}</DatoCorto>
              <DatoCorto k="Tipología">{o.tipologia ?? "—"}</DatoCorto>
              <DatoCorto k="Publicado">{fecha(o.fechaPublicacion)}</DatoCorto>
              {o.criterio && <DatoCorto k="Criterio">{o.criterio.nombre}</DatoCorto>}
            </dl>
            {o.objeto && <p className="oracion mt-4 rounded-ctl bg-fondo px-3.5 py-3 text-[13.5px] leading-relaxed text-tinta-2">{o.objeto}</p>}
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

function CifraHero({ valor, rotulo, nota, alerta }: { valor: ReactNode; rotulo: string; nota?: string; alerta?: boolean }) {
  return (
    <div className={"rounded-[14px] border px-4 py-3.5 backdrop-blur-sm " + (alerta ? "border-oro/40 bg-oro/[.08]" : "border-white/10 bg-white/[.04]")}>
      <div className="text-[12px] font-medium text-white/55">{rotulo}</div>
      <div className="num mt-1.5 text-[22px] font-extrabold leading-tight text-white sm:text-[24px]">{valor}</div>
      {nota && <div className={"mt-1 text-[12px] " + (alerta ? "font-semibold text-oro" : "text-white/40")}>{nota}</div>}
    </div>
  );
}

/** El encaje, de 0 a 100, en un anillo con el degradado del logo. */
function Medidor({ valor }: { valor: number | null | undefined }) {
  const v = Math.max(0, Math.min(100, valor ?? 0));
  const R = 46, C = 2 * Math.PI * R;
  return (
    <div className="relative mx-auto size-[124px] shrink-0" title={`Encaje ${v} de 100`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <defs><linearGradient id="anillo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#efbf01" /><stop offset="1" stopColor="#d8800d" /></linearGradient></defs>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--linea-2)" strokeWidth="10" />
        <circle cx="60" cy="60" r={R} fill="none" stroke="url(#anillo)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(v / 100) * C} ${C}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="num text-[32px] font-extrabold leading-none">{valor ?? "—"}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[.1em] text-tinta-3">encaje</div>
        </div>
      </div>
    </div>
  );
}

function Veredicto({ tono, children }: { tono: string; children: ReactNode }) {
  const estilo = tono === "verde" ? "bg-verde-suave text-verde-profundo border-verde/30" : tono === "rojo" ? "bg-rojo-suave text-rojo border-rojo/30" : "bg-oro-suave text-[#8a5a00] border-oro/40";
  return <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-display text-[16px] font-bold ${estilo}`}><span className="size-2 rounded-full bg-current" />{children}</span>;
}

function TituloBloque({ icono, tono, children }: { icono: ReactNode; tono: "rojo" | "verde"; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={"grid size-8 shrink-0 place-items-center rounded-ctl " + (tono === "rojo" ? "bg-rojo-suave text-rojo" : "bg-verde-suave text-verde-profundo")}>{icono}</span>
      <h3 className="text-[15.5px] font-bold">{children}</h3>
    </div>
  );
}

function MiniCifra({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) {
  return (
    <div className="rounded-ctl border border-linea-2 bg-fondo px-4 py-3">
      <div className="text-[12px] font-medium text-tinta-3">{rotulo}</div>
      <div className="num mt-1 text-[22px] font-extrabold leading-tight">{valor}</div>
      <div className="text-[12.5px] text-tinta-2">{nota}</div>
    </div>
  );
}

function DatoCorto({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-semibold uppercase tracking-[.06em] text-tinta-3">{k}</dt>
      <dd className="m-0 mt-0.5 text-[13.5px] leading-snug text-tinta">{children}</dd>
    </div>
  );
}
