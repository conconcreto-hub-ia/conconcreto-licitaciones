// Enlaza los correos que ya estaban en la base con su proveedor (y su licitación), por el hilo de la invitación.
// Desde el 8-nov-2026 cada correo nuevo nace enlazado; esto es para los de antes. Se puede correr de nuevo.
//
//   npx tsx scripts/enlazar-correos.ts
import "./_env";
import { db } from "../src/lib/db";

(async () => {
  const invitaciones = await db.invitacion.findMany({ where: { hiloId: { not: null } }, select: { hiloId: true, proveedorId: true, paquete: { select: { oportunidadId: true } } } });
  let n = 0;
  for (const i of invitaciones) {
    const r = await db.correo.updateMany({ where: { hiloId: i.hiloId!, proveedorId: null }, data: { proveedorId: i.proveedorId } });
    await db.correo.updateMany({ where: { hiloId: i.hiloId!, oportunidadId: null }, data: { oportunidadId: i.paquete.oportunidadId } });
    n += r.count;
  }
  console.log(`${n} correos enlazados a su proveedor (${invitaciones.length} hilos de invitación).`);
})().finally(() => db.$disconnect());
