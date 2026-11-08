"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui";
import { IconoProveedor, IconoCorreo, IconoReloj, IconoX } from "@/components/iconos";
import { sugerirProveedoresAhora, aprobarYEnviarAhora, recordatoriosAhora, quitarInvitacion } from "@/app/acciones";

export function AccionesPaquete({ paqueteId, borradores, pendientes }: { paqueteId: string; borradores: number; pendientes: number }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const correr = (fn: () => Promise<string>) => empezar(async () => { setMsg(null); try { setMsg(await fn()); router.refresh(); } catch (e) { setMsg(`Falló: ${e instanceof Error ? e.message : e}`); } });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" disabled={pendiente} onClick={() => correr(async () => { const r = await sugerirProveedoresAhora(paqueteId); return `${r.elegidos} propuestos · ${r.base} de la base · ${r.secop} del SECOP verificados${r.sancionados ? ` · ${r.sancionados} descartados por sanciones` : ""}`; })}>
          <IconoProveedor />Buscar proveedores
        </Boton>
        {pendientes > 0 && (
          <Boton variante="secundario" disabled={pendiente} onClick={() => correr(async () => { const r = await recordatoriosAhora(paqueteId); return r.enviados ? `${r.enviados} recordatorios enviados` : "Nadie pendiente de recordatorio"; })}>
            <IconoReloj />Recordar a los pendientes
          </Boton>
        )}
        <Boton variante="primario" disabled={pendiente || borradores === 0} onClick={() => correr(async () => { const r = await aprobarYEnviarAhora(paqueteId); return `${r.enviadas} enviadas${r.bloqueadas.length ? ` · ${r.bloqueadas.length} quedan en borrador: su correo no está habilitado para envíos` : ""}`; })}>
          <IconoCorreo />{pendiente ? "Trabajando…" : `Aprobar y enviar${borradores ? ` (${borradores})` : ""}`}
        </Boton>
      </div>
      {msg && <span className="text-[13px] text-white/75">{msg}</span>}
    </div>
  );
}

export function QuitarInvitacion({ invitacionId, paqueteId }: { invitacionId: string; paqueteId: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return (
    <button
      title="Quitar de la lista"
      disabled={pendiente}
      onClick={() => empezar(async () => { await quitarInvitacion(invitacionId, paqueteId); router.refresh(); })}
      className="grid size-7 place-items-center rounded-ctl text-tinta-3 hover:bg-rojo-suave hover:text-rojo disabled:opacity-50"
    >
      <IconoX className="size-3.5" />
    </button>
  );
}
