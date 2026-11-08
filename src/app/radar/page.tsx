import { Barra } from "@/components/barra";
import { Cifra, Contenedor, Encabezado, Insignia, SeccionEt, Tarjeta, Vacio } from "@/components/ui";
import { IconoRadar } from "@/components/iconos";
import { BotonRadar } from "./boton";
import { db } from "@/lib/db";
import { fechaHora, haceCuanto } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Radar() {
  const [corridas, porOrigen, criterios] = await Promise.all([
    db.corridaRadar.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    db.oportunidad.count({ where: { origen: "secop" } }),
    db.criterio.count({ where: { activo: true } }),
  ]);
  const ultima = corridas[0];
  const creditos = corridas.reduce((s, c) => s + c.creditos, 0);

  return (
    <>
      <Barra>
        <Contenedor className="pb-10 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[.08em] text-white/75"><span className="punto-vivo" />Puerta B · SECOP</div>
              <h1 className="mt-4 max-w-[760px] text-[34px] font-extrabold leading-[1.08] text-white sm:text-[42px]">El radar lee el SECOP <span className="dorado">antes que nadie</span></h1>
              <p className="mt-3 max-w-[640px] text-[15px] text-white/70">Cada mañana busca las obras publicadas desde la última vez, se queda con las que encajan con los criterios de Conconcreto y les arma la ficha de go/no-go.</p>
            </div>
            <BotonRadar />
          </div>
          <div className="mt-8 flex flex-wrap gap-x-12 gap-y-6">
            <Cifra oscuro valor={ultima ? haceCuanto(ultima.createdAt) : "—"} rotulo="Última corrida" />
            <Cifra oscuro valor={porOrigen} rotulo="Oportunidades que ha encontrado" />
            <Cifra oscuro valor={criterios} rotulo="Criterios activos" />
            <Cifra oscuro valor={creditos} rotulo="Créditos de Croma usados" nota="en las últimas 15 corridas" />
          </div>
        </Contenedor>
      </Barra>

      <Contenedor className="space-y-5 py-10">
        <Encabezado et="Corridas" titulo="Lo que ha revisado" bajada="Cada corrida pregunta desde un día antes de la anterior, para no perder lo que se publicó tarde." />
        {corridas.length === 0 ? (
          <Vacio icono={<IconoRadar className="size-5" />} titulo="El radar todavía no ha corrido">La primera corrida mira las últimas tres semanas.</Vacio>
        ) : (
          <Tarjeta className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-tinta-3">
                  <th className="px-5 py-3 font-medium">Cuándo</th><th className="px-3 py-3 font-medium">Ventana</th>
                  <th className="px-3 py-3 text-right font-medium">Revisados</th><th className="px-3 py-3 text-right font-medium">Nuevas</th>
                  <th className="px-3 py-3 text-right font-medium">Créditos</th><th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {corridas.map((c) => (
                  <tr key={c.id} className="border-t border-linea-2">
                    <td className="px-5 py-3">{fechaHora(c.createdAt)}</td>
                    <td className="px-3 py-3 text-tinta-2">{fechaHora(c.desde)} → {fechaHora(c.hasta)}</td>
                    <td className="tabular px-3 py-3 text-right">{c.revisados}</td>
                    <td className="tabular px-3 py-3 text-right font-semibold">{c.nuevos}</td>
                    <td className="tabular px-3 py-3 text-right">{c.creditos}</td>
                    <td className="px-5 py-3">{c.error ? <Insignia tono="rojo">Falló</Insignia> : <Insignia tono="verde">Bien</Insignia>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        )}
        <SeccionEt>De dónde salen los datos</SeccionEt>
        <p className="max-w-[760px] text-[14px] text-tinta-2">Croma mantiene una copia al día del SECOP I y II. El radar consulta esa copia (1 crédito por página de 100 procesos), no el sitio del SECOP. Los pliegos y anexos no vienen en esa copia: cuando el comité aprueba, se descargan del SECOP y se reenvían al buzón del agente.</p>
      </Contenedor>
    </>
  );
}
