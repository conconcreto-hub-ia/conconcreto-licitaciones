import { Barra } from "@/components/barra";
import { Cifra, Contenedor, Encabezado, SeccionEt, Vacio, BotonLink } from "@/components/ui";
import { IconoRadar } from "@/components/iconos";
import { FilaOportunidad } from "@/components/oportunidad";
import { db } from "@/lib/db";
import { copCorto, diasHasta, haceCuanto } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const [oportunidades, ultimaCorrida] = await Promise.all([
    db.oportunidad.findMany({ orderBy: [{ encaje: { sort: "desc", nulls: "last" } }, { fechaCierre: "asc" }] }),
    db.corridaRadar.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const abiertas = oportunidades.filter((o) => !["descartada", "cerrada"].includes(o.estado) && (diasHasta(o.fechaCierre) ?? 1) >= 0);
  const paraComite = abiertas.filter((o) => ["nueva", "analizada", "en_comite"].includes(o.estado));
  const enMarcha = abiertas.filter((o) => ["aprobada", "en_cotizacion"].includes(o.estado));
  const descartadas = oportunidades.filter((o) => o.estado === "descartada");
  const valor = abiertas.reduce((s, o) => s + Number(o.valorEstimado ?? 0), 0);
  const estaSemana = abiertas.filter((o) => { const d = diasHasta(o.fechaCierre); return d !== null && d <= 7; }).length;
  const recomendadas = abiertas.filter((o) => o.recomendacion === "go").length;

  return (
    <>
      <Barra>
        <Contenedor className="pb-10 pt-8">
          <div className="flex flex-wrap items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[.08em] text-white/75">
            <span className="punto-vivo" />
            {ultimaCorrida ? `Radar · última corrida ${haceCuanto(ultimaCorrida.createdAt)} · ${ultimaCorrida.revisados} procesos revisados` : "El radar todavía no ha corrido"}
          </div>
          <h1 className="mt-4 max-w-[860px] text-[34px] font-extrabold leading-[1.08] text-white sm:text-[44px]">
            Lo que vale la pena <span className="dorado">licitar esta semana</span>
          </h1>
          <div className="mt-8 flex flex-wrap gap-x-12 gap-y-6">
            <Cifra oscuro valor={abiertas.length} rotulo="Oportunidades abiertas" />
            <Cifra oscuro valor={recomendadas} rotulo="El agente recomienda presentarse" />
            <Cifra oscuro valor={estaSemana} rotulo="Cierran en 7 días o menos" />
            <Cifra oscuro valor={copCorto(valor)} rotulo="Valor en estudio" />
          </div>
        </Contenedor>
      </Barra>

      <Contenedor className="space-y-12 py-10">
        {oportunidades.length === 0 ? (
          <Vacio icono={<IconoRadar className="size-5" />} titulo="Todavía no hay oportunidades" accion={<BotonLink href="/radar" variante="primario">Ir al radar</BotonLink>}>
            Entran de dos formas: el radar las encuentra en el SECOP, o alguien reenvía una invitación al buzón del agente.
          </Vacio>
        ) : (
          <>
            <section className="space-y-4">
              <Encabezado et="Para el comité" titulo={`${paraComite.length} por decidir`} bajada="Ordenadas por qué tanto encajan con lo que Conconcreto hace y gana. La recomendación es del agente; la decisión es del comité." />
              <div className="space-y-3">{paraComite.map((o) => <FilaOportunidad key={o.id} o={o} />)}</div>
            </section>

            {enMarcha.length > 0 && (
              <section className="space-y-4">
                <SeccionEt>En marcha</SeccionEt>
                <div className="space-y-3">{enMarcha.map((o) => <FilaOportunidad key={o.id} o={o} />)}</div>
              </section>
            )}

            {descartadas.length > 0 && (
              <section className="space-y-4">
                <SeccionEt>Descartadas</SeccionEt>
                <div className="space-y-3 opacity-70">{descartadas.map((o) => <FilaOportunidad key={o.id} o={o} />)}</div>
              </section>
            )}
          </>
        )}
      </Contenedor>
    </>
  );
}
