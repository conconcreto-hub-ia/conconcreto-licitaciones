import { Barra } from "@/components/barra";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/permisos";
import { Chip, Contenedor, Encabezado, Insignia, Tarjeta, Vacio } from "@/components/ui";
import { IconoProveedor, IconoEscudo } from "@/components/iconos";
import { db } from "@/lib/db";
import { puedeEnviarA } from "@/lib/invitaciones";
import { haceCuanto } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Proveedores() {
  const yo = await exigirSesion();
  const proveedores = await db.proveedor.findMany({
    orderBy: [{ fuente: "asc" }, { nombre: "asc" }],
    include: { invitaciones: { select: { estado: true } } },
  });
  const base = proveedores.filter((p) => p.fuente === "base");
  const secop = proveedores.filter((p) => p.fuente !== "base");
  const permitidos = process.env.ENVIO_DOMINIOS_PERMITIDOS ?? "agentmail.to";

  const Lista = ({ titulo, bajada, items }: { titulo: string; bajada: string; items: typeof proveedores }) => (
    <section className="space-y-4">
      <Encabezado et={titulo} titulo={`${items.length} proveedores`} bajada={bajada} />
      {items.length === 0 ? <Vacio icono={<IconoProveedor className="size-5" />} titulo="Todavía no hay">Aparecen cuando el agente busca proveedores para un paquete.</Vacio> : (
        <Tarjeta className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[14px]">
            <thead><tr className="text-left text-[12px] text-tinta-3"><th className="px-5 py-3 font-medium">Proveedor</th><th className="px-3 py-3 font-medium">Cotiza</th><th className="px-3 py-3 font-medium">Verificación SECOP</th><th className="px-3 py-3 text-right font-medium">Invitaciones</th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-linea-2 align-top">
                  <td className="px-5 py-3">
                    <div className="font-semibold">{p.nombre}</div>
                    <div className="text-[12.5px] text-tinta-3">{p.nit ? `NIT ${p.nit} · ` : ""}{p.ciudad ?? "—"}</div>
                    <div className="text-[12.5px] text-tinta-3">{p.correo ?? "Sin correo"}{p.correo && !puedeEnviarA(p.correo) ? " · no habilitado para envíos" : ""}</div>
                  </td>
                  <td className="px-3 py-3"><div className="flex max-w-[280px] flex-wrap gap-1.5">{p.actividades.map((a) => <Chip key={a}>{a}</Chip>)}</div></td>
                  <td className="px-3 py-3 text-[13px]">
                    {!p.verificadoEn ? <span className="text-tinta-3">Sin verificar</span> : (
                      <div className="flex flex-col items-start gap-1">
                        {p.sancionado ? <Insignia tono="rojo">Con sanciones</Insignia> : <Insignia tono="verde"><IconoEscudo className="size-3.5" />Sin sanciones</Insignia>}
                        <span className="text-tinta-2">{p.contratosPublicos ?? 0} contratos públicos</span>
                        <span className="text-[12px] text-tinta-3">verificado {haceCuanto(p.verificadoEn)}</span>
                      </div>
                    )}
                  </td>
                  <td className="tabular px-3 py-3 text-right">{p.invitaciones.length}<div className="text-[12px] text-tinta-3">{p.invitaciones.filter((i) => i.estado === "cotizo").length} cotizó</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
    </section>
  );

  return (
    <>
      <Barra />
      <Contenedor className="space-y-12 py-10">
        <Tarjeta className="flex items-start gap-3 border-oro/50 bg-oro-suave p-4">
          <IconoEscudo className="mt-0.5 text-[#8a5a00]" />
          <p className="text-[14px] text-tinta">
            <b className="font-display">Modo prueba.</b> El agente solo envía correos a <span className="font-mono">{permitidos}</span>. Los proveedores reales que encuentra en el SECOP quedan en la lista, verificados, pero sus invitaciones no salen hasta que se habilite el envío a propósito.
          </p>
        </Tarjeta>
        <Lista titulo="Base de Conconcreto" bajada="Los proveedores con los que ya trabaja la compañía. Son los primeros que el agente invita." items={base} />
        <Lista titulo="Encontrados en el SECOP" bajada="Empresas del directorio de proveedores del SECOP que el agente encontró por actividad y región, con sus sanciones y contratos públicos verificados." items={secop} />
      </Contenedor>
    </>
  );
}
