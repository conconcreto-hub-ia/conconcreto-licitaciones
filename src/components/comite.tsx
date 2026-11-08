"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "./ui";
import { decidirEnComite } from "@/app/acciones";

export function FormComite({ id, ayuda }: { id: string; ayuda: string }) {
  const router = useRouter();
  const nota = useRef<HTMLTextAreaElement>(null);
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const decidir = (decision: "aprobar" | "descartar") => {
    const texto = nota.current?.value.trim() ?? "";
    if (decision === "descartar" && !texto) {
      setAviso("Para descartar, escribe la razón: es lo que el área lee la próxima vez que aparezca algo parecido.");
      nota.current?.focus();
      return;
    }
    setAviso(null);
    const f = new FormData();
    f.set("id", id); f.set("decision", decision); f.set("nota", texto);
    empezar(async () => {
      try { await decidirEnComite(f); router.refresh(); } catch (e) { setAviso(e instanceof Error ? e.message : String(e)); }
    });
  };

  return (
    <div className="mt-3 space-y-3">
      <textarea ref={nota} rows={3} onChange={() => aviso && setAviso(null)} placeholder="Nota del comité (obligatoria para descartar)" className={`w-full resize-none rounded-ctl border bg-fondo px-3 py-2.5 text-[14px] outline-none placeholder:text-tinta-3 focus:border-verde ${aviso ? "border-rojo" : "border-linea"}`} />
      {aviso && <p className="text-[12.5px] leading-snug text-rojo">{aviso}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="primario" disabled={pendiente} onClick={() => decidir("aprobar")}>Presentarse</Boton>
        <Boton variante="peligro" disabled={pendiente} onClick={() => decidir("descartar")}>Descartar</Boton>
      </div>
      <p className="text-[12.5px] leading-snug text-tinta-3">{ayuda}</p>
    </div>
  );
}
