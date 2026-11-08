import { Barra } from "@/components/barra";
import { Chip, Contenedor, Encabezado, Insignia, Tarjeta } from "@/components/ui";
import { db } from "@/lib/db";
import { cop } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Criterios() {
  const criterios = await db.criterio.findMany({ orderBy: { nombre: "asc" }, include: { _count: { select: { oportunidades: true } } } });
  const remitentes = await db.remitenteAutorizado.findMany({ orderBy: { nombre: "asc" } });

  return (
    <>
      <Barra />
      <Contenedor className="space-y-10 py-10">
        <Encabezado
          et="Criterios"
          titulo="Lo que le interesa a Conconcreto"
          bajada="Con esto decide el radar qué procesos del SECOP vale la pena mirar. Son supuestos iniciales, tomados de lo que contó el equipo en las reuniones: el área de licitaciones los ajusta."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {criterios.map((c) => (
            <Tarjeta key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-bold">{c.nombre}</h3>
                  <p className="mt-0.5 text-[13px] text-tinta-3">Tipología · {c.tipologia}</p>
                </div>
                <Insignia tono={c.activo ? "verde" : "neutro"}>{c.activo ? `${c._count.oportunidades} encontradas` : "Apagado"}</Insignia>
              </div>
              <div className="mt-4 space-y-3 text-[13.5px]">
                <div><div className="mb-1.5 text-tinta-3">Busca</div><div className="flex flex-wrap gap-1.5">{c.palabrasClave.map((k) => <Chip key={k}>{k}</Chip>)}</div></div>
                <div><div className="mb-1.5 text-tinta-3">Descarta si dice</div><div className="flex flex-wrap gap-1.5">{c.excluir.map((k) => <Chip key={k}>{k}</Chip>)}</div></div>
                <div className="grid grid-cols-2 gap-3 border-t border-dashed border-linea pt-3">
                  <div><div className="text-tinta-3">Desde</div><div className="font-semibold">{c.montoMinimo ? cop(c.montoMinimo) : "Cualquier valor"}</div></div>
                  <div><div className="text-tinta-3">Dónde</div><div className="font-semibold">{c.departamentos.length ? c.departamentos.join(", ") : "Todo el país"}</div></div>
                </div>
                <div><div className="text-tinta-3">Modalidades</div><div>{c.modalidades.join(" · ")}</div></div>
              </div>
            </Tarjeta>
          ))}
        </div>

        <section className="space-y-4">
          <Encabezado et="Buzón" titulo="Quién puede abrir una oportunidad" bajada="Solo los correos reenviados desde estas direcciones abren una oportunidad. Lo que escribe cualquier otra persona se guarda como dato, nunca como instrucción." />
          <Tarjeta className="divide-y divide-linea-2">
            {remitentes.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-[14px]"><span className="font-semibold">{r.nombre}</span><span className="font-mono text-[13px] text-tinta-2">{r.correo}</span></div>
            ))}
          </Tarjeta>
        </section>
      </Contenedor>
    </>
  );
}
