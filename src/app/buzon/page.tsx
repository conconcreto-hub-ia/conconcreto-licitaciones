import Link from "next/link";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/permisos";
import { Barra } from "@/components/barra";
import { Contenedor, Encabezado, Insignia, Tarjeta, Vacio } from "@/components/ui";
import { IconoCorreo, IconoReenvio, IconoAgente, IconoEscudo } from "@/components/iconos";
import { BotonBuzon } from "./boton";
import { db } from "@/lib/db";
import { fechaHora } from "@/lib/formato";
import type { Prisma } from "@prisma/client";
import { FiltrosBuzon } from "./filtros";
import { tituloDe } from "@/components/oportunidad";

export const dynamic = "force-dynamic";

export default async function Buzon({ searchParams }: { searchParams: Promise<{ licitacion?: string; proveedor?: string; dir?: string }> }) {
  const yo = await exigirSesion();
  const { licitacion, proveedor, dir } = await searchParams;
  const where: Prisma.CorreoWhereInput = {
    ...(licitacion === "ninguna" ? { oportunidadId: null } : licitacion ? { oportunidadId: licitacion } : {}),
    ...(proveedor ? { proveedorId: proveedor } : {}),
    ...(dir === "entrante" || dir === "saliente" ? { direccion: dir } : {}),
  };
  const filtrando = !!(licitacion || proveedor || dir);
  const [correos, total, conCorreos, proveedoresConCorreos] = await Promise.all([
    db.correo.findMany({ where, orderBy: { recibidoEn: "desc" }, take: filtrando ? 200 : 60, include: { oportunidad: { select: { id: true, codigo: true, titulo: true, ficha: true } }, proveedor: { select: { id: true, nombre: true } } } }),
    db.correo.count({ where }),
    db.oportunidad.findMany({ where: { correos: { some: {} } }, select: { id: true, codigo: true, titulo: true, ficha: true }, orderBy: { updatedAt: "desc" } }),
    db.proveedor.findMany({ where: { correos: { some: {} } }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  const buzon = process.env.AGENTMAIL_INBOX;

  return (
    <>
      <Barra>
        <Contenedor className="pb-10 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[.08em] text-white/75"><span className="punto-vivo" />Puerta A · Invitaciones</div>
              <h1 className="mt-4 max-w-[760px] text-[34px] font-extrabold leading-[1.08] text-white sm:text-[42px]">Reenvía la invitación. <span className="dorado">El agente hace el resto.</span></h1>
              <p className="mt-3 max-w-[640px] text-[15px] text-white/70">
                Desde tu Outlook, reenvía la invitación del cliente a <span className="font-mono text-white">{buzon}</span>. El agente la lee, la registra con su ficha y te contesta en el mismo hilo con lo que entendió y lo que falta para cotizar.
              </p>
            </div>
            {puede(yo.rol, "buzon.revisar") && <BotonBuzon />}
          </div>
        </Contenedor>
      </Barra>

      <Contenedor className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-4">
          <Encabezado et="Correos" titulo={filtrando ? `${total} ${total === 1 ? "correo" : "correos"} con este filtro` : "Lo que ha pasado por el buzón"} />
          <Tarjeta className="p-4">
            <FiltrosBuzon
              licitaciones={conCorreos.map((o) => ({ v: o.id, e: `${o.codigo} · ${tituloDe(o)}` }))}
              proveedores={proveedoresConCorreos.map((p) => ({ v: p.id, e: p.nombre }))}
            />
          </Tarjeta>
          {correos.length === 0 ? (
            filtrando
              ? <Vacio icono={<IconoCorreo className="size-5" />} titulo="Ningún correo con este filtro">Prueba con otra licitación u otro proveedor, o limpia los filtros.</Vacio>
              : <Vacio icono={<IconoCorreo className="size-5" />} titulo="Todavía no ha llegado nada">Reenvía una invitación al buzón y pulsa «Revisar el buzón ahora».</Vacio>
          ) : (
            <Tarjeta className="divide-y divide-linea-2">
              {correos.map((c) => (
                <div key={c.id} className="flex gap-4 px-5 py-4">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${c.direccion === "saliente" ? "bg-noche-2 text-oro" : "bg-verde-suave text-verde-profundo"}`}>
                    {c.direccion === "saliente" ? <IconoAgente /> : c.esReenvio ? <IconoReenvio /> : <IconoCorreo />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="m-0 truncate font-display text-[14.5px] font-bold">{c.asunto}</p>
                      <span className="text-[12px] text-tinta-3">{fechaHora(c.recibidoEn)}</span>
                    </div>
                    <p className="m-0 mt-0.5 truncate text-[13px] text-tinta-2">{c.direccion === "saliente" ? `El agente le respondió a ${c.para}` : `${c.de}${c.remitenteOriginal ? ` · original de ${c.remitenteOriginal}` : ""}`}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.direccion === "entrante" && (c.proveedor ? <Insignia tono="verde">Respuesta del proveedor</Insignia> : c.autorizado ? <Insignia tono="verde">Autorizado</Insignia> : <Insignia tono="oro">Sin autorizar · solo se guardó</Insignia>)}
                      {c.oportunidad && <Link href={`/buzon?licitacion=${c.oportunidad.id}`} title={`Ver solo los correos de ${tituloDe(c.oportunidad)}`}><Insignia tono="noche">{c.oportunidad.codigo}</Insignia></Link>}
                      {c.proveedor && <Link href={`/buzon?proveedor=${c.proveedor.id}`} title="Ver solo los correos de este proveedor"><Insignia tono="neutro">{c.proveedor.nombre}</Insignia></Link>}
                    </div>
                  </div>
                </div>
              ))}
            </Tarjeta>
          )}
        </section>
        <aside className="space-y-4">
          <Tarjeta className="p-5">
            <div className="flex items-center gap-2 text-verde-profundo"><IconoEscudo /><h3 className="text-[15.5px] font-bold text-tinta">Qué hace y qué no</h3></div>
            <ul className="mt-3 space-y-2.5 pl-0 text-[13.5px] text-tinta-2">
              <li className="list-none">Solo abre oportunidades con los correos reenviados por personas autorizadas (ver Criterios).</li>
              <li className="list-none">Lo que escribe cualquier otra persona se guarda como dato. Nunca como instrucción.</li>
              <li className="list-none">Si un correo le pide algo al agente, lo trata como texto del cliente: no lo obedece.</li>
              <li className="list-none">Solo le contesta a quien reenvió, en el mismo hilo. No le escribe a nadie más por su cuenta.</li>
            </ul>
          </Tarjeta>
          <Tarjeta className="p-5">
            <h3 className="text-[15.5px] font-bold">Los pliegos del SECOP</h3>
            <p className="mt-2 text-[13.5px] text-tinta-2">Cuando el comité aprueba un proceso, se descargan los pliegos del SECOP y se reenvían al buzón con el código del proceso (por ejemplo CO1.NTC.11182912) en el asunto. El agente los pega a esa oportunidad.</p>
          </Tarjeta>
        </aside>
      </Contenedor>
    </>
  );
}
