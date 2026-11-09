import Link from "next/link";
import { Barra } from "@/components/barra";
import { Contenedor, Encabezado, Insignia, SeccionEt, Tarjeta, Vacio } from "@/components/ui";
import { IconoComite, IconoFlecha, IconoReloj, IconoCheck } from "@/components/iconos";
import { Etapas, ListaPendientes, etiquetaEtapa } from "@/components/proceso";
import { exigirSesion } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { cargarProcesos, EN_CURSO, tituloCorto } from "@/lib/procesos-datos";
import { cierre, copCorto, diasHasta, haceCuanto, nombrePropio } from "@/lib/formato";

export const dynamic = "force-dynamic";
export const metadata = { title: "En curso · Licitaciones Conconcreto" };

export default async function Procesos() {
  await exigirSesion();
  const [procesos, cerradas, enComite] = await Promise.all([
    cargarProcesos(EN_CURSO),
    cargarProcesos({ estado: "cerrada" }),
    db.oportunidad.count({ where: { estado: { in: ["nueva", "analizada", "en_comite"] } } }),
  ]);
  const pendientes = procesos.flatMap(({ o, e }) => e.pendientes.map((p) => ({ ...p, proceso: `${o.codigo} · ${tituloCorto(o)}` })));
  pendientes.sort((a, b) => Number(b.urgente) - Number(a.urgente));
  const recibidas = procesos.reduce((s, x) => s + x.e.cotizaciones.recibidas, 0);
  const invitados = procesos.reduce((s, x) => s + x.e.cotizaciones.invitados, 0);

  return (
    <>
      <Barra>
        <Contenedor className="pb-8 pt-7">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[.08em] text-white/70"><span className="punto-vivo" />Licitaciones en curso</div>
          <h1 className="mt-3 max-w-[820px] text-[30px] font-extrabold leading-[1.1] text-white sm:text-[38px]">En qué va cada una y <span className="dorado">dónde te necesita</span></h1>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cuadro valor={procesos.length} rotulo="Licitándose" />
            <Cuadro valor={pendientes.length} rotulo="Esperan a una persona" resaltar={pendientes.length > 0} />
            <Cuadro valor={`${recibidas} de ${invitados}`} rotulo="Cotizaciones recibidas" nota="de los proveedores invitados" />
            <Cuadro valor={cerradas.length} rotulo="Terminadas" />
          </div>
        </Contenedor>
      </Barra>

      <Contenedor className="space-y-10 py-9">
        <section className="space-y-4">
          <Encabezado et="Te necesitan" titulo={pendientes.length ? `${pendientes.length} ${pendientes.length === 1 ? "cosa espera" : "cosas esperan"} a una persona` : "Nada espera a una persona"} bajada="El agente arma, envía, lee y persigue. Esto es lo que solo puede hacer alguien del equipo: decidir, confirmar, aprobar, contestar y adjudicar." />
          {pendientes.length > 0 ? (
            <Tarjeta className="overflow-hidden"><ListaPendientes pendientes={pendientes} proceso={(p) => (p as (typeof pendientes)[number]).proceso} /></Tarjeta>
          ) : (
            <Tarjeta className="flex items-center gap-3 px-5 py-4 text-[14px] text-tinta-2"><IconoCheck className="text-verde" />Todo lo que está en curso lo tiene el agente o un proveedor.</Tarjeta>
          )}
          {enComite > 0 && (
            <Link href="/" className="flex items-center justify-between gap-3 rounded-sup border border-dashed border-linea px-5 py-3.5 text-[14px] text-tinta-2 transition-colors hover:border-oro hover:text-tinta">
              <span className="flex items-center gap-2.5"><IconoComite className="text-verde-profundo" />Y {enComite} {enComite === 1 ? "oportunidad espera" : "oportunidades esperan"} la decisión del comité</span>
              <IconoFlecha className="size-4" />
            </Link>
          )}
        </section>

        <section className="space-y-4">
          <SeccionEt>Licitándose</SeccionEt>
          {procesos.length === 0 ? (
            <Vacio icono={<IconoComite className="size-5" />} titulo="Ninguna licitación en curso">Cuando el comité aprueba una oportunidad, aparece aquí con su avance.</Vacio>
          ) : (
            <div className="space-y-4">
              {procesos.map(({ o, e }) => {
                const d = diasHasta(o.fechaCierre);
                const ultimo = o.eventos[0];
                return (
                  <Link key={o.id} href={`/procesos/${o.id}`} className="block">
                    <Tarjeta viva className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                            <span className="font-mono text-tinta-3">{o.codigo}</span>
                            <Insignia tono={e.pendientes.length ? "oro" : "verde"} punto>{e.pendientes.length ? `Te necesita · ${e.pendientes.length}` : "Lo tiene el agente"}</Insignia>
                          </div>
                          <h3 className="mt-2 text-[19px] font-extrabold leading-snug">{tituloCorto(o)}</h3>
                          <p className="mt-0.5 text-[13.5px] text-tinta-2">{nombrePropio(o.entidad)}</p>
                        </div>
                        <div className="flex gap-6 text-right">
                          <div><div className="num text-[19px] font-extrabold">{copCorto(o.valorEstimado)}</div><div className="text-[12px] text-tinta-3">presupuesto</div></div>
                          <div>
                            <div className={"flex items-center justify-end gap-1.5 text-[14px] font-semibold " + (d !== null && d <= 7 ? "text-rojo" : "text-tinta")}><IconoReloj className="size-4" />{cierre(o.fechaCierre)}</div>
                            <div className="text-[12px] text-tinta-3">{e.cotizaciones.recibidas} de {e.cotizaciones.invitados} cotizaciones</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-5"><Etapas e={e} /></div>
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-linea-2 pt-4 text-[13px]">
                        <span className="min-w-0 text-tinta-2"><b className="font-semibold text-tinta">Va en: {etiquetaEtapa(e)}</b>{ultimo && <> · Lo último: {ultimo.descripcion} <span className="text-tinta-3">({haceCuanto(ultimo.createdAt)})</span></>}</span>
                        <span className="inline-flex items-center gap-1.5 font-display font-semibold text-verde-profundo">Ver el hilo <IconoFlecha className="size-3.5" /></span>
                      </div>
                    </Tarjeta>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {cerradas.length > 0 && (
          <section className="space-y-3">
            <SeccionEt>Terminadas</SeccionEt>
            <Tarjeta className="divide-y divide-linea-2">
              {cerradas.map(({ o }) => (
                <Link key={o.id} href={`/procesos/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-fondo">
                  <span className="min-w-0 truncate"><span className="font-mono text-[12.5px] text-tinta-3">{o.codigo}</span> · {tituloCorto(o)}</span>
                  <IconoFlecha className="size-4 text-tinta-3" />
                </Link>
              ))}
            </Tarjeta>
          </section>
        )}
      </Contenedor>
    </>
  );
}

function Cuadro({ valor, rotulo, nota, resaltar }: { valor: React.ReactNode; rotulo: string; nota?: string; resaltar?: boolean }) {
  return (
    <div className={"rounded-[14px] border px-4 py-3.5 " + (resaltar ? "border-oro/40 bg-oro/[.08]" : "border-white/10 bg-white/[.04]")}>
      <div className="text-[12px] font-medium text-white/55">{rotulo}</div>
      <div className={"num mt-1.5 text-[24px] font-extrabold leading-tight " + (resaltar ? "text-oro" : "text-white")}>{valor}</div>
      {nota && <div className="mt-1 text-[12px] text-white/40">{nota}</div>}
    </div>
  );
}
