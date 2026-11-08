import Link from "next/link";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/permisos";
import { notFound } from "next/navigation";
import { Barra } from "@/components/barra";
import { Aja, Cifra, Contenedor, Encabezado, Insignia, SeccionEt, Tarjeta, Vacio } from "@/components/ui";
import { IconoFlecha, IconoProveedor, IconoEscudo, IconoCuadro, IconoDocumento } from "@/components/iconos";
import { AccionesPaquete, QuitarInvitacion } from "./acciones-paquete";
import { db } from "@/lib/db";
import { cuadroComparativo, puedeEnviarA } from "@/lib/invitaciones";
import { ESTADO_INVITACION, TIPO_PAQUETE } from "@/lib/etiquetas";
import { cop, copCorto, fecha, haceCuanto } from "@/lib/formato";

export const dynamic = "force-dynamic";

const pesos = (n: number | null) => (n === null ? "—" : `$${Math.round(n).toLocaleString("es-CO")}`);

export default async function PaquetePagina({ params }: { params: Promise<{ id: string }> }) {
  const yo = await exigirSesion();
  const { id } = await params;
  const existe = await db.paquete.findUnique({ where: { id }, select: { id: true } });
  if (!existe) notFound();

  const { paquete, filas, proveedores, totalItems } = await cuadroComparativo(id);
  const [o, invitaciones, bimbau] = await Promise.all([
    db.oportunidad.findUniqueOrThrow({ where: { id: paquete.oportunidadId } }),
    db.invitacion.findMany({ where: { paqueteId: id }, include: { proveedor: true, cotizacion: true }, orderBy: { createdAt: "asc" } }),
    db.archivo.findFirst({ where: { paqueteId: id, tipo: "bimbau" }, select: { id: true, nombre: true } }),
  ]);
  const borradores = invitaciones.filter((i) => i.estado === "borrador");
  const enviables = borradores.filter((i) => i.proveedor.correo && puedeEnviarA(i.proveedor.correo));
  const pendientes = invitaciones.filter((i) => ["enviada", "recordada"].includes(i.estado)).length;
  const cotizaron = invitaciones.filter((i) => i.estado === "cotizo").length;
  const mejor = proveedores[0];

  return (
    <>
      <Barra>
        <Contenedor className="pb-10 pt-7">
          <Link href={`/oportunidades/${o.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/60 hover:text-white">
            <IconoFlecha className="size-3.5 rotate-180" /> {o.titulo}
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="font-display text-[12px] font-bold uppercase tracking-[.1em] text-oro">Paquete · {TIPO_PAQUETE[paquete.tipo]}</span>
              <h1 className="mt-2 max-w-[760px] text-[30px] font-extrabold leading-[1.1] text-white sm:text-[38px]">{paquete.nombre}</h1>
              {paquete.porque && <p className="mt-2 max-w-[640px] text-[15px] text-white/70">{paquete.porque}</p>}
            </div>
            {puede(yo.rol, "proveedores.invitar") && <AccionesPaquete paqueteId={id} borradores={enviables.length} pendientes={pendientes} />}
          </div>
          <div className="mt-7 flex flex-wrap gap-x-12 gap-y-6">
            <Cifra oscuro valor={totalItems} rotulo="Ítems del paquete" />
            <Cifra oscuro valor={invitaciones.length} rotulo="Proveedores en la lista" />
            <Cifra oscuro valor={`${cotizaron} de ${invitaciones.filter((i) => i.estado !== "borrador").length}`} rotulo="Ya cotizaron" />
            <Cifra oscuro valor={paquete.fechaLimite ? fecha(paquete.fechaLimite) : "—"} rotulo="Reciben cotizaciones hasta" />
          </div>
        </Contenedor>
      </Barra>

      <Contenedor className="space-y-10 py-10">
        {/* Proveedores */}
        <section className="space-y-4">
          <Encabezado et="Proveedores" titulo="A quién se invita" bajada="Primero la base de Conconcreto; si no alcanza, el directorio del SECOP. Todos se verifican antes: un proveedor con sanciones no se invita. Nada sale hasta que licitaciones apruebe." />
          {invitaciones.length === 0 ? (
            <Vacio icono={<IconoProveedor className="size-5" />} titulo="Todavía no hay proveedores en la lista">Pulsa «Buscar proveedores» y el agente propone a quién invitar.</Vacio>
          ) : (
            <Tarjeta className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-tinta-3">
                    <th className="px-5 py-3 font-medium">Proveedor</th><th className="px-3 py-3 font-medium">Verificación SECOP</th>
                    <th className="px-3 py-3 font-medium">Estado</th><th className="px-3 py-3 text-right font-medium">Cotización</th><th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {invitaciones.map((i) => {
                    const e = ESTADO_INVITACION[i.estado];
                    const bloqueado = i.estado === "borrador" && !!i.proveedor.correo && !puedeEnviarA(i.proveedor.correo);
                    return (
                      <tr key={i.id} className="border-t border-linea-2 align-top">
                        <td className="px-5 py-3">
                          <div className="font-semibold">{i.proveedor.nombre}</div>
                          <div className="text-[12.5px] text-tinta-3">{i.proveedor.correo ?? "Sin correo"} · {i.proveedor.ciudad ?? "—"} · {i.proveedor.fuente === "base" ? "Base Conconcreto" : "Directorio SECOP"}</div>
                        </td>
                        <td className="px-3 py-3 text-[13px]">
                          {!i.proveedor.verificadoEn ? <span className="text-tinta-3">Sin verificar{!i.proveedor.nit ? " (sin NIT)" : ""}</span> : (
                            <div className="flex flex-col gap-1">
                              {i.proveedor.sancionado ? <Insignia tono="rojo">Con sanciones</Insignia> : <Insignia tono="verde"><IconoEscudo className="size-3.5" />Sin sanciones</Insignia>}
                              <span className="text-tinta-2">{i.proveedor.contratosPublicos ?? 0} contratos públicos</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Insignia tono={e.tono}>{e.etiqueta}</Insignia>
                          {bloqueado && <div className="mt-1 max-w-[220px] text-[12px] text-[#8a5a00]">Correo no habilitado para envíos mientras se prueba</div>}
                          {i.recordatorios > 0 && <div className="mt-1 text-[12px] text-tinta-3">{i.recordatorios} recordatorio{i.recordatorios > 1 ? "s" : ""}</div>}
                          {i.ultimaActividad && i.estado !== "borrador" && <div className="mt-0.5 text-[12px] text-tinta-3">{haceCuanto(i.ultimaActividad)}</div>}
                        </td>
                        <td className="tabular px-3 py-3 text-right">
                          {i.cotizacion ? <><div className="font-semibold">{cop(i.cotizacion.valorTotal)}</div><div className="text-[12px] text-tinta-3">{i.cotizacion.plazoDias ? `${i.cotizacion.plazoDias} días` : ""}</div></> : <span className="text-tinta-3">—</span>}
                        </td>
                        <td className="px-2 py-3">{i.estado === "borrador" && puede(yo.rol, "proveedores.invitar") && <QuitarInvitacion invitacionId={i.id} paqueteId={id} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Tarjeta>
          )}
          {bimbau && <a href={`/api/archivos/${bimbau.id}`} className="inline-flex items-center gap-1.5 font-display text-[13.5px] font-semibold text-verde-profundo hover:underline"><IconoDocumento />El formulario que se envía: {bimbau.nombre}</a>}
        </section>

        {/* Cuadro comparativo */}
        <section className="space-y-4">
          <Encabezado et="Cuadro comparativo" titulo="Lo que cotizaron" bajada="Los valores por ítem salen del formulario que devolvió cada proveedor; los totales los suma el código. El agente no adjudica: arma el cuadro y decide una persona." />
          {proveedores.length === 0 ? (
            <Vacio icono={<IconoCuadro className="size-5" />} titulo="Todavía no hay cotizaciones">Cuando los proveedores respondan en el hilo de su invitación, aquí aparece el cuadro.</Vacio>
          ) : (
            <>
              {mejor && proveedores.length > 1 && (
                <Aja etiqueta="Lo que muestra el cuadro">
                  {mejor.nombre.replace(/\.$/, "")} tiene el menor total ({copCorto(mejor.total)}){proveedores[1].total && mejor.total ? `, ${Math.round((1 - mejor.total / proveedores[1].total) * 100)} % por debajo de ${proveedores[1].nombre.replace(/\.$/, "")}` : ""}.
                  {mejor.itemsCotizados < totalItems ? ` Ojo: solo trae precio en ${mejor.itemsCotizados} de ${totalItems} ítems.` : ""}
                  {proveedores.some((p) => p.itemsCotizados === 0) ? ` ${proveedores.filter((p) => p.itemsCotizados === 0).map((p) => p.nombre.replace(/\.$/, "")).join(", ")} cotizó solo un total, sin precios por ítem: no se puede comparar línea a línea.` : ""}
                </Aja>
              )}
              <Tarjeta className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-linea text-left text-[12px] text-tinta-3">
                      <th className="px-4 py-3 font-medium">Código</th><th className="px-3 py-3 font-medium">Ítem</th><th className="px-3 py-3 text-right font-medium">Cantidad</th>
                      {proveedores.map((p) => <th key={p.invitacionId} className="px-3 py-3 text-right font-semibold text-tinta">{p.nombre}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.actividad.id} className="border-t border-linea-2">
                        <td className="px-4 py-2.5 font-mono text-[12.5px] text-tinta-3">{f.actividad.codigo}</td>
                        <td className="px-3 py-2.5">{f.actividad.descripcion}</td>
                        <td className="tabular whitespace-nowrap px-3 py-2.5 text-right text-tinta-2">{f.actividad.cantidad?.toLocaleString("es-CO")} {f.actividad.unidad}</td>
                        {proveedores.map((p) => {
                          const precio = f.precios.find((x) => x.invitacionId === p.invitacionId);
                          const esMin = precio?.unitario !== null && precio?.unitario === f.minimo && proveedores.filter((q) => f.precios.find((x) => x.invitacionId === q.invitacionId)?.unitario !== null).length > 1;
                          return (
                            <td key={p.invitacionId} className={`tabular whitespace-nowrap px-3 py-2.5 text-right ${esMin ? "font-semibold text-verde-profundo" : ""}`}>
                              {precio?.unitario !== null && precio?.unitario !== undefined ? <><div>{pesos(precio.unitario)}</div><div className="text-[11.5px] text-tinta-3">{pesos(precio.subtotal)}</div></> : <span className="text-tinta-3">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-linea bg-fondo">
                      <td colSpan={3} className="px-4 py-3 font-display font-bold">Total antes de IVA</td>
                      {proveedores.map((p, i) => <td key={p.invitacionId} className={`tabular whitespace-nowrap px-3 py-3 text-right font-display font-bold ${i === 0 ? "text-verde-profundo" : ""}`}>{cop(p.total)}</td>)}
                    </tr>
                    <tr className="bg-fondo text-[12.5px] text-tinta-2">
                      <td colSpan={3} className="px-4 pb-3">Plazo · validez</td>
                      {proveedores.map((p) => <td key={p.invitacionId} className="px-3 pb-3 text-right">{p.plazoDias ? `${p.plazoDias} días` : "—"} · {p.validezDias ? `${p.validezDias} días` : "—"}</td>)}
                    </tr>
                  </tfoot>
                </table>
              </Tarjeta>
              <SeccionEt>Lo que dijo cada uno</SeccionEt>
              <div className="grid gap-3 md:grid-cols-2">
                {proveedores.map((p) => <Tarjeta key={p.invitacionId} className="p-4"><div className="font-semibold">{p.nombre}</div><p className="mt-1 text-[13.5px] text-tinta-2">{p.observaciones}</p></Tarjeta>)}
              </div>
            </>
          )}
        </section>
      </Contenedor>
    </>
  );
}
