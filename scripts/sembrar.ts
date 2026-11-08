// Criterios iniciales del radar y remitentes autorizados del buzón.
// Son SUPUESTOS tomados de las llamadas de venta (Jaime: «puentes, túneles, vías, hidroeléctricas»;
// privados: hoteles, centros comerciales, bodegas) y de los proyectos reales de Jhon
// (alcantarillado, EBAR, puente peaje). Los valida el área de licitaciones en la S4.
// Idempotente: se puede correr de nuevo.
import "./_env";
import { db } from "../src/lib/db";

const OBRA_PUBLICA = ["Licitación pública Obra Publica", "Licitación pública"];
const EXCLUIR = ["interventoría", "interventoria", "consultoría", "consultoria", "mantenimiento rutinario", "vigilancia", "aseo"];

const CRITERIOS = [
  { nombre: "Vías y corredores", tipologia: "Vías", palabrasClave: ["vía", "via", "corredor", "pavimentación", "carretera", "doble calzada", "intersección"], montoMinimo: BigInt(10_000_000_000) },
  { nombre: "Puentes y viaductos", tipologia: "Puentes", palabrasClave: ["puente", "viaducto", "intercambio vial"], montoMinimo: BigInt(8_000_000_000) },
  { nombre: "Túneles", tipologia: "Túneles", palabrasClave: ["túnel", "tunel"], montoMinimo: BigInt(10_000_000_000) },
  { nombre: "Acueducto y alcantarillado", tipologia: "Agua", palabrasClave: ["alcantarillado", "acueducto", "colector", "estación de bombeo", "planta de tratamiento", "EBAR", "PTAR", "PTAP"], montoMinimo: BigInt(5_000_000_000) },
  { nombre: "Energía e hidroeléctricas", tipologia: "Energía", palabrasClave: ["hidroeléctrica", "central hidroeléctrica", "presa", "subestación"], montoMinimo: BigInt(10_000_000_000) },
  { nombre: "Edificaciones institucionales", tipologia: "Edificación", palabrasClave: ["hospital", "colegio", "institución educativa", "sede", "edificio", "centro de salud"], montoMinimo: BigInt(8_000_000_000) },
];

async function main() {
  for (const c of CRITERIOS) {
    const existe = await db.criterio.findFirst({ where: { nombre: c.nombre } });
    const data = { ...c, excluir: EXCLUIR, modalidades: OBRA_PUBLICA, departamentos: [], codigosUnspsc: [], notas: "Supuesto inicial. Validar con el área de licitaciones." };
    if (existe) await db.criterio.update({ where: { id: existe.id }, data });
    else await db.criterio.create({ data });
  }
  const remitentes = [
    { correo: "jbedoyag@conconcreto.com", nombre: "Jhon Alejandro Bedoya" },
    { correo: "ahoyosh@stayirrelevant.com", nombre: "irrelevant (pruebas)" },
  ];
  for (const r of remitentes) await db.remitenteAutorizado.upsert({ where: { correo: r.correo }, update: { nombre: r.nombre }, create: r });
  console.log("criterios:", await db.criterio.count(), "· remitentes:", await db.remitenteAutorizado.count());
}
main().finally(() => db.$disconnect());
