import { describe, it, expect } from "vitest";
import { estadoDelProceso, type EntradaProceso } from "../procesos";

const hoy = new Date("2026-11-08T12:00:00Z");
const dias = (n: number) => new Date(hoy.getTime() + n * 86_400_000);
const base = (o: Partial<EntradaProceso> = {}): EntradaProceso => ({ id: "o1", codigo: "CO1.NTC.1", origen: "secop", estado: "en_cotizacion", tieneFicha: true, formularios: 1, paquetes: [], ...o });
const paq = (estado: "propuesto" | "confirmado", inv: { estado: string; proveedor?: string }[] = [], fechaLimite: Date | null = dias(10)) =>
  ({ id: `p-${Math.random()}`, nombre: "Concreto", estado, fechaLimite, invitaciones: inv.map((i, k) => ({ estado: i.estado as never, proveedor: i.proveedor ?? `Prov ${k}` })) });

describe("en qué va una licitación y qué necesita de una persona", () => {
  it("sin decidir: solo pide al comité", () => {
    const e = estadoDelProceso(base({ estado: "analizada" }), hoy);
    expect(e.actual).toBe("comite");
    expect(e.pendientes.map((p) => p.clave)).toEqual(["comite"]);
  });
  it("aprobada del SECOP sin pliegos: pide reenviarlos con el código", () => {
    const e = estadoDelProceso(base({ estado: "aprobada", formularios: 0 }), hoy);
    expect(e.actual).toBe("documentos");
    expect(e.pendientes[0].texto).toMatch(/pliegos/);
    expect(e.pendientes[0].detalle).toMatch(/CO1\.NTC\.1/);
  });
  it("llegaron documentos pero no el formulario: lo dice así", () => {
    const e = estadoDelProceso(base({ estado: "aprobada", formularios: 0, documentos: 1 }), hoy);
    expect(e.pendientes[0].texto).toBe("Falta el formulario de cantidades");
    expect(e.pendientes[0].detalle).toMatch(/Llegaron 1 documento/);
  });
  it("varios paquetes sin proveedores: un solo pendiente", () => {
    const e = estadoDelProceso(base({ paquetes: [paq("confirmado"), paq("confirmado"), paq("confirmado")] }), hoy);
    expect(e.pendientes.filter((p) => p.clave === "sinprov")).toHaveLength(1);
    expect(e.pendientes[0].texto).toMatch(/^3 paquetes/);
  });
  it("paquetes propuestos: pide confirmarlos", () => {
    const e = estadoDelProceso(base({ paquetes: [paq("propuesto"), paq("propuesto")] }), hoy);
    expect(e.actual).toBe("paquetes");
    expect(e.pendientes.some((p) => p.texto.includes("los 2 paquetes"))).toBe(true);
  });
  it("invitaciones en borrador: pide aprobarlas", () => {
    const e = estadoDelProceso(base({ paquetes: [paq("confirmado", [{ estado: "borrador" }, { estado: "borrador" }])] }), hoy);
    expect(e.actual).toBe("invitaciones");
    expect(e.pendientes.some((p) => p.texto.startsWith("Aprobar 2 invitaciones"))).toBe(true);
  });
  it("un proveedor que pregunta: pide contestarle", () => {
    const e = estadoDelProceso(base({ paquetes: [paq("confirmado", [{ estado: "respondida", proveedor: "Argos" }, { estado: "enviada" }])] }), hoy);
    expect(e.pendientes.some((p) => p.texto.startsWith("Argos escribió"))).toBe(true);
  });
  it("tres cotizaciones: listo para comparar y adjudicar", () => {
    const e = estadoDelProceso(base({ paquetes: [paq("confirmado", [{ estado: "cotizo" }, { estado: "cotizo" }, { estado: "cotizo" }])] }), hoy);
    expect(e.hechas.cotizaciones).toBe(true);
    expect(e.actual).toBe("adjudicacion");
    expect(e.pendientes.some((p) => p.texto.startsWith("Comparar"))).toBe(true);
    expect(e.cotizaciones).toEqual({ recibidas: 3, invitados: 3 });
  });
  it("cierra pronto con pocas cotizaciones: avisa el riesgo", () => {
    const e = estadoDelProceso(base({ paquetes: [paq("confirmado", [{ estado: "cotizo" }, { estado: "enviada" }], dias(3))] }), hoy);
    expect(e.pendientes.some((p) => p.clave.startsWith("riesgo") && p.texto.includes("1 de 3"))).toBe(true);
  });
  it("venció con al menos una cotización: se puede comparar", () => {
    const e = estadoDelProceso(base({ paquetes: [paq("confirmado", [{ estado: "cotizo" }, { estado: "enviada" }], dias(-1))] }), hoy);
    expect(e.hechas.cotizaciones).toBe(true);
  });
  it("descartada o cerrada: nada pendiente", () => {
    expect(estadoDelProceso(base({ estado: "descartada" }), hoy).pendientes).toEqual([]);
    expect(estadoDelProceso(base({ estado: "cerrada" }), hoy).actual).toBeNull();
  });
});
