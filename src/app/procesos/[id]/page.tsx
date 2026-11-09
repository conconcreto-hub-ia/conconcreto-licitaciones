import Link from "next/link";
import { notFound } from "next/navigation";
import { Barra } from "@/components/barra";
import { Contenedor, Insignia, SeccionEt, Tarjeta } from "@/components/ui";
import { IconoAgente, IconoCorreo, IconoFlecha, IconoPersona, IconoReloj, IconoCheck, IconoAlerta } from "@/components/iconos";
import { Etapas, ListaPendientes, etiquetaEtapa } from "@/components/proceso";
import { exigirSesion } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { cargarProceso, tituloCorto } from "@/lib/procesos-datos";
import { cierre, copCorto, fecha, fechaHora, nombrePropio } from "@/lib/formato";

export const dynamic = "force-dynamic";

const VER = [
  { v: "todo", e: "Todo" },
  { v: "personas", e: "Personas" },
  { v: "agente", e: "Agente" },
  { v: "correos", e: "Correos" },
] as const;
type Ver = (typeof VER)[number]["v"];

type Paso =
  | { clase: "evento"; id: string; fecha: Date; actor: "agente" | "persona" | "sistema"; tipo: string; texto: string }
  | { clase: "correo"; id: string; fecha: Date; saliente: boolean; asunto: string; con: string; proveedor: { id: string; nombre: string } | null; resumen: string | null };

export default async function HiloDelProceso({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ver?: string }> }) {
  await exigirSesion();
  const { id } = await params;
  const ver: Ver = (VER.map((x) => x.v) as string[]).includes((await searchParams).ver ?? "") ? ((await searchParams).ver as Ver) : "todo";
  const p = await cargarProceso(id);
  if (!p) notFound();
  const { o, e } = p;

  const [eventos, correos] = await Promise.all([
    db.evento.findMany({ where: { oportunidadId: id }, orderBy: { createdAt: "desc" } }),
    db.correo.findMany({ where: { oportunidadId: id }, orderBy: { recibidoEn: "desc" }, include: { proveedor: { select: { id: true, nombre: true } } } }),
  ]);
  const todos: Paso[] = [
    ...eventos.map((x) => ({ clase: "evento" as const, id: x.id, fecha: x.createdAt, actor: x.actor, tipo: x.tipo, texto: x.descripcion })),
    ...correos.map((c) => ({ clase: "correo" as const, id: c.id, fecha: c.recibidoEn, saliente: c.direccion === "saliente", asunto: c.asunto, con: c.direccion === "saliente" ? c.para : c.de, proveedor: c.proveedor, resumen: c.resumen })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  const pasos = todos.filter((x) => ver === "todo" || (ver === "correos" ? x.clase === "correo" : x.clase === "evento" && (ver === "personas" ? x.actor === "persona" : x.actor !== "persona")));
  const cuenta = (v: Ver) => todos.filter((x) => v === "todo" || (v === "correos" ? x.clase === "correo" : x.clase === "evento" && (v === "personas" ? x.actor === "persona" : x.actor !== "persona"))).length;

  // Agrupar por día para leer el hilo como un diario.
  const dias = new Map<string, Paso[]>();
  for (const x of pasos) {
    const k = x.fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" });
    dias.set(k, [...(dias.get(k) ?? []), x]);
  }

  return (
    <>
      <Barra>
        <Contenedor className="pb-8 pt-6">
          <Link href="/procesos" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/55 hover:text-white"><IconoFlecha className="size-3.5 rotate-180" /> En curso</Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] text-white/45">{o.codigo}</span>
            <Insignia tono={e.pendientes.length ? "oro" : "verde"} punto>{e.pendientes.length ? `Te necesita · ${e.pendientes.length}` : "Lo tiene el agente"}</Insignia>
          </div>
          <h1 className="mt-3 max-w-[920px] text-[28px] font-extrabold leading-[1.1] text-white sm:text-[34px]">{tituloCorto(o)}</h1>
          <p className="mt-1.5 text-[14.5px] text-white/65">{nombrePropio(o.entidad)} · {copCorto(o.valorEstimado)} · <span className="inline-flex items-center gap-1"><IconoReloj className="size-3.5" />{cierre(o.fechaCierre)}{o.fechaCierre ? ` (${fecha(o.fechaCierre)})` : ""}</span></p>
          <div className="mt-6 rounded-[14px] border border-white/10 bg-white/[.04] p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-white/80">Va en: <span className="text-oro">{etiquetaEtapa(e)}</span></span>
              <span className="text-[12px] text-white/45">{Math.round(e.avance * 100)} % · {e.cotizaciones.recibidas} de {e.cotizaciones.invitados} cotizaciones</span>
            </div>
            <Etapas e={e} oscura />
          </div>
        </Contenedor>
      </Barra>

      <Contenedor className="grid gap-7 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* El hilo */}
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <SeccionEt>El hilo</SeccionEt>
              <h2 className="mt-2 text-[24px] font-extrabold">Todo lo que ha pasado</h2>
            </div>
            <nav className="flex flex-wrap gap-1.5" aria-label="Qué ver">
              {VER.map((x) => (
                <Link key={x.v} href={x.v === "todo" ? `/procesos/${id}` : `/procesos/${id}?ver=${x.v}`} scroll={false}
                  className={"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors " + (ver === x.v ? "border-noche-2 bg-noche-2 text-white" : "border-linea bg-papel text-tinta-2 hover:border-tinta-3")}>
                  {x.e}<span className={ver === x.v ? "text-white/60" : "text-tinta-3"}>{cuenta(x.v)}</span>
                </Link>
              ))}
            </nav>
          </div>

          {pasos.length === 0 ? (
            <Tarjeta className="px-5 py-8 text-center text-[14px] text-tinta-3">No hay nada de este tipo todavía.</Tarjeta>
          ) : (
            <div className="space-y-6">
              {[...dias.entries()].map(([dia, lista]) => (
                <div key={dia}>
                  <div className="mb-2 text-[12px] font-bold uppercase tracking-[.08em] text-tinta-3">{dia}</div>
                  <Tarjeta className="px-5 py-2">
                    <ol className="m-0 p-0">
                      {lista.map((x, i) => (
                        <li key={x.id} className="relative flex list-none gap-3.5 py-3.5">
                          {i < lista.length - 1 && <span className="absolute bottom-0 left-[17px] top-[50px] w-px bg-linea" />}
                          <Icono paso={x} />
                          <div className="min-w-0 flex-1">
                            {x.clase === "evento" ? (
                              <>
                                <p className="m-0 text-[14.5px] leading-snug text-tinta">{x.texto}</p>
                                <p className="m-0 mt-1 text-[12px] text-tinta-3">{x.actor === "agente" ? "Agente" : x.actor === "persona" ? "Persona" : "Sistema"} · {fechaHora(x.fecha)}</p>
                              </>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Insignia tono={x.saliente ? "noche" : "verde"}>{x.saliente ? "Salió" : "Llegó"}</Insignia>
                                  {x.proveedor && <Link href={`/buzon?proveedor=${x.proveedor.id}`} className="text-[12.5px] font-semibold text-verde-profundo hover:underline">{x.proveedor.nombre}</Link>}
                                </div>
                                <p className="m-0 mt-1.5 text-[14.5px] font-semibold leading-snug">{x.asunto}</p>
                                <p className="m-0 mt-0.5 truncate text-[12.5px] text-tinta-3">{x.saliente ? `Para ${x.con}` : `De ${x.con}`} · {fechaHora(x.fecha)}</p>
                                {x.resumen && <p className="m-0 mt-2 line-clamp-3 rounded-ctl bg-fondo px-3 py-2 text-[13px] leading-relaxed text-tinta-2">{x.resumen}</p>}
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </Tarjeta>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Lo que espera a una persona y cómo va cada paquete */}
        <aside className="space-y-5">
          <Tarjeta className={"overflow-hidden " + (e.pendientes.length ? "border-oro/50 ring-4 ring-oro/10" : "")}>
            <div className="flex items-center justify-between px-5 pt-5">
              <SeccionEt>Te necesita</SeccionEt>
              {e.pendientes.length > 0 && <span className="num text-[18px] font-extrabold text-[#8a5a00]">{e.pendientes.length}</span>}
            </div>
            {e.pendientes.length ? <div className="mt-2"><ListaPendientes pendientes={e.pendientes} /></div> : <p className="flex items-center gap-2 px-5 pb-5 pt-3 text-[13.5px] text-tinta-2"><IconoCheck className="text-verde" />Nada por ahora: lo tiene el agente o un proveedor.</p>}
          </Tarjeta>

          <Tarjeta className="p-5">
            <SeccionEt>Paquetes</SeccionEt>
            {o.paquetes.length === 0 ? <p className="mt-3 text-[13.5px] text-tinta-3">Todavía no hay paquetes.</p> : (
              <ul className="mt-3 space-y-3 pl-0">
                {o.paquetes.map((pq) => {
                  const inv = pq.invitaciones;
                  const c = { cotizo: inv.filter((i) => i.estado === "cotizo").length, declino: inv.filter((i) => i.estado === "declino").length, borrador: inv.filter((i) => i.estado === "borrador").length, total: inv.length };
                  return (
                    <li key={pq.id} className="list-none">
                      <Link href={`/paquetes/${pq.id}`} className="block rounded-ctl border border-linea-2 px-3.5 py-3 transition-colors hover:border-linea hover:bg-fondo">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-[14px] font-semibold">{pq.nombre}</span>
                          {pq.estado === "propuesto" ? <Insignia tono="oro">Por confirmar</Insignia> : c.borrador ? <Insignia tono="oro">{c.borrador} por aprobar</Insignia> : null}
                        </div>
                        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-linea-2">
                          {c.total > 0 && <><span className="bg-verde" style={{ width: `${(c.cotizo / c.total) * 100}%` }} /><span className="bg-tinta-3/40" style={{ width: `${(c.declino / c.total) * 100}%` }} /></>}
                        </div>
                        <div className="mt-1.5 text-[12px] text-tinta-3">{c.total ? `${c.cotizo} cotizaron · ${c.declino} declinaron · ${c.total} invitados` : "Sin proveedores invitados"}{pq.fechaLimite ? ` · hasta ${fecha(pq.fechaLimite)}` : ""}</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>

          <Link href={`/oportunidades/${o.id}`} className="flex items-center justify-between rounded-sup border border-linea bg-papel px-5 py-3.5 text-[14px] font-semibold transition-colors hover:border-tinta-3">
            Ver la ficha de go/no-go <IconoFlecha className="size-4" />
          </Link>
        </aside>
      </Contenedor>
    </>
  );
}

function Icono({ paso }: { paso: Paso }) {
  const base = "relative z-10 grid size-9 shrink-0 place-items-center rounded-full";
  if (paso.clase === "correo") return <span className={`${base} ${paso.saliente ? "bg-noche-2 text-oro" : "bg-verde-suave text-verde-profundo"}`}><IconoCorreo className="size-4" /></span>;
  if (paso.tipo.endsWith("error")) return <span className={`${base} bg-rojo-suave text-rojo`}><IconoAlerta className="size-4" /></span>;
  if (paso.actor === "persona") return <span className={`${base} bg-oro-suave text-[#8a5a00]`}><IconoPersona className="size-4" /></span>;
  return <span className={`${base} bg-noche-2 text-oro`}><IconoAgente className="size-4" /></span>;
}
