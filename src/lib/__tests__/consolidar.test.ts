import { describe, it, expect } from "vitest";
import { consolidar } from "../consolidar";

const A = (codigo: string, descripcion: string, unidad: string, cantidad: number, orden = 0) => ({ id: codigo, codigo, descripcion, unidad, cantidad, orden });

describe("concreto (Altavista)", () => {
  const c = consolidar("Concreto premezclado", "suministro", [
    A("3.1", "Concreto de limpieza f'c=14 MPa e=0.05 m", "m2", 2150, 1), A("3.2", "Concreto zapatas f'c=28 MPa", "m3", 1340, 2),
    A("5.1", "Piso industrial en concreto f'c=35 MPa e=0.20 m con fibra", "m2", 16800, 3), A("8.1", "Pavimento rígido patio de maniobras e=0.25 m", "m2", 9400, 4),
    A("8.2", "Andenes en concreto", "m2", 1650, 5), A("x", "Placa f'c=28 MPa e=15 cm", "m2", 100, 6),
  ])!;
  const linea = (re: RegExp) => c.lineas.find((l) => re.test(l.descripcion))?.cantidad;
  it("m² × espesor y redondeo hacia arriba", () => expect(linea(/14 MPa/)).toBe(108));
  it("suma m³ directos con m² convertidos, y el espesor en cm pasa a m", () => expect(linea(/28 MPa$/)).toBe(1355));
  it("lo especial (fibra) va en su propia línea", () => expect(linea(/35 MPa fibra/)).toBe(3360));
  it("sin f'c no se supone: queda pendiente", () => expect(c.pendientes.map((p) => p.codigo)).toEqual(["8.1", "8.2"]));
});

describe("acero", () => {
  const a = consolidar("Acero de refuerzo", "suministro", [A("3.3", "Acero de refuerzo fy=420 MPa", "kg", 168000.4), A("4.9", "Acero fy=420 MPa vigas", "kg", 1200), A("5.2", "Malla electrosoldada D-131", "m2", 16800), A("z", "Acero varios", "ton", 3)])!;
  it("suma por grado en kg", () => expect(a.lineas[0]).toMatchObject({ descripcion: "Suministro de acero de refuerzo fy = 420 MPa", cantidad: 169201, unidad: "KG" }));
  it("la malla va aparte en su unidad", () => expect(a.lineas.find((l) => /malla/.test(l.descripcion))).toMatchObject({ cantidad: 16800 }));
  it("toneladas no se convierten a ojo", () => expect(a.pendientes.map((p) => p.codigo)).toEqual(["z"]));
});

describe("mampostería", () => {
  const m = consolidar("Bloques de arcilla", "suministro", [A("9.1", "Muro en bloque de arcilla 10x20x40 junta 1 cm", "m2", 1000), A("9.2", "Muro sin dimensiones", "m2", 50)])!;
  it("unidades por m² = 1 / ((largo + junta)(alto + junta))", () => expect(m.lineas[0].cantidad).toBe(Math.ceil(1000 / (0.41 * 0.21) - 1e-9)));
  it("sin dimensiones queda pendiente", () => expect(m.pendientes).toHaveLength(1));
});

describe("lo que no se consolida", () => {
  it("un servicio", () => expect(consolidar("Estructura metálica", "servicio", [])).toBeNull());
  it("la mano de obra de concreto", () => expect(consolidar("Mano de obra de estructura en concreto", "mano_de_obra", [])).toBeNull());
  it("un suministro que no es concreto, acero ni bloques", () => expect(consolidar("Columnas prefabricadas", "suministro", [])).toBeNull());
});
