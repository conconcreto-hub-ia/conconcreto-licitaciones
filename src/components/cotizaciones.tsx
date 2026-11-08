import Link from "next/link";
import { Insignia, Tarjeta } from "./ui";
import { IconoReloj } from "./iconos";
import { cierre, diasHasta } from "@/lib/formato";

export type PaqueteEnCurso = {
  id: string; nombre: string; oportunidad: string; fechaLimite: Date | null;
  invitados: number; cotizaron: number; declinaron: number; pendientes: number; porAprobar: number;
};

/** Riesgo: el boceto de Jhon (S3). Cierra en 7 días o menos y tiene menos de 3 cotizaciones. */
export const enRiesgo = (p: PaqueteEnCurso) => { const d = diasHasta(p.fechaLimite); return d !== null && d <= 7 && p.cotizaron < 3; };

export function TablaCotizaciones({ paquetes }: { paquetes: PaqueteEnCurso[] }) {
  return (
    <Tarjeta className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[14px]">
        <thead>
          <tr className="text-left text-[12px] text-tinta-3">
            <th className="px-5 py-3 font-medium">Paquete</th><th className="px-3 py-3 font-medium">Cotizaciones</th>
            <th className="px-3 py-3 font-medium">Reciben hasta</th><th className="px-5 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {paquetes.map((p) => {
            const riesgo = enRiesgo(p);
            return (
              <tr key={p.id} className="border-t border-linea-2 hover:bg-fondo">
                <td className="px-5 py-3">
                  <Link href={`/paquetes/${p.id}`} className="font-semibold hover:underline">{p.nombre}</Link>
                  <div className="truncate text-[12.5px] text-tinta-3">{p.oportunidad}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5" aria-label={`${p.cotizaron} de 3 cotizaciones`}>
                      {[0, 1, 2].map((i) => <span key={i} className={`h-2 w-5 rounded-full ${i < p.cotizaron ? "[background:var(--degradado)]" : "bg-linea-2"}`} />)}
                    </div>
                    <span className="tabular text-[13px] font-semibold">{p.cotizaron} de {p.invitados}</span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-tinta-3">{p.pendientes ? `${p.pendientes} sin responder` : ""}{p.declinaron ? `${p.pendientes ? " · " : ""}${p.declinaron} declinó` : ""}</div>
                </td>
                <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] ${riesgo ? "font-semibold text-rojo" : "text-tinta-2"}`}><IconoReloj className="size-3.5" />{cierre(p.fechaLimite)}</span></td>
                <td className="px-5 py-3">
                  {p.porAprobar > 0 && p.invitados === 0 ? <Insignia tono="oro">Invitaciones por aprobar</Insignia>
                    : riesgo ? <Insignia tono="rojo">En riesgo · faltan cotizaciones</Insignia>
                    : p.cotizaron >= 3 || (p.pendientes === 0 && p.cotizaron > 0) ? <Insignia tono="verde">Listo para comparar</Insignia>
                    : p.pendientes === 0 && p.cotizaron === 0 ? <Insignia tono="rojo">Nadie cotizó · invitar a más</Insignia>
                    : <Insignia tono="neutro">Esperando respuestas</Insignia>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Tarjeta>
  );
}
