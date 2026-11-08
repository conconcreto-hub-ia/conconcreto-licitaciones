// Las rutinas corriendo en un computador, mientras la app no esté desplegada.
//
//   npx tsx scripts/rutinas.ts
//
//   · Radar del SECOP: lunes a viernes, 7:00 (hora Colombia).
//   · Recordatorios a proveedores: lunes a viernes, 8:00.
//   · Buzón: cada 3 minutos de 7:00 a 19:00, de lunes a viernes. Primero le pregunta a AgentMail si llegó
//     algo (eso no toca la base); solo si hay un correo nuevo revisa el buzón. Así Neon puede dormir.
import "./_env";
import { agentmail } from "../src/lib/agentmail";
import { rutinaBuzon, rutinaRadar, rutinaRecordatorios } from "../src/lib/rutinas";

const hora = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
const habil = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;
const log = (...x: unknown[]) => console.log(`[${hora().toLocaleString("es-CO")}]`, ...x);

let ultimoMensaje: string | null = null;
const hechoHoy = new Set<string>();

async function ciclo() {
  const ahora = hora();
  const dia = ahora.toISOString().slice(0, 10);
  try {
    if (habil(ahora) && ahora.getHours() >= 7 && !hechoHoy.has(`radar-${dia}`)) { hechoHoy.add(`radar-${dia}`); log("radar", await rutinaRadar()); }
    if (habil(ahora) && ahora.getHours() >= 8 && !hechoHoy.has(`rec-${dia}`)) { hechoHoy.add(`rec-${dia}`); log("recordatorios", await rutinaRecordatorios()); }
    if (habil(ahora) && ahora.getHours() >= 7 && ahora.getHours() < 19) {
      const { messages } = await agentmail.listar(1);
      const tope = messages[0]?.message_id ?? null;
      if (tope && tope !== ultimoMensaje) { ultimoMensaje = tope; log("buzón", await rutinaBuzon()); }
    }
  } catch (e) { log("falló:", e instanceof Error ? e.message : e); }
}

log("Rutinas encendidas. Ctrl+C para apagarlas.");
ciclo();
setInterval(ciclo, 3 * 60_000);
