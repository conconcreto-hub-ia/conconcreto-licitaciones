import { describe, it, expect, beforeEach } from "vitest";
import { puedeEnviarA } from "../invitaciones";
import { esReenvio, remitenteOriginal, partirRemitente } from "../agentmail";

describe("modo prueba: a quién puede escribir el agente", () => {
  beforeEach(() => { process.env.ENVIO_DOMINIOS_PERMITIDOS = "agentmail.to"; });
  it("deja los buzones de prueba", () => expect(puedeEnviarA("prueba-prov-a-cc@agentmail.to")).toBe(true));
  it("bloquea un proveedor real", () => expect(puedeEnviarA("INTEINSAPAVIMENTOS@GMAIL.COM")).toBe(false));
  it("no se engaña con un dominio que termina parecido", () => expect(puedeEnviarA("x@notagentmail.to")).toBe(false));
  it("sin variable, solo agentmail.to", () => { delete process.env.ENVIO_DOMINIOS_PERMITIDOS; expect(puedeEnviarA("compras@conconcreto.com")).toBe(false); });
});

describe("reenvíos", () => {
  it("Outlook en español", () => expect(esReenvio("RV: Invitación a cotizar", "texto")).toBe(true));
  it("Gmail", () => expect(esReenvio("Invitación", "---------- Forwarded message ---------\nFrom: X")).toBe(true));
  it("el remitente original", () => expect(remitenteOriginal("hola\n________________________________\nDe: Carolina Mejía <cmejia@x.co>\nEnviado: jueves")).toBe("Carolina Mejía <cmejia@x.co>"));
  it("parte el remitente", () => expect(partirRemitente("Jhon Bedoya <JBedoyaG@conconcreto.com>")).toEqual({ nombre: "Jhon Bedoya", correo: "jbedoyag@conconcreto.com" }));
});
