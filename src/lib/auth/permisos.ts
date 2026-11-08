// Qué puede hacer cada rol. Un solo lugar: las acciones lo exigen y las pantallas lo consultan.
import type { Rol } from "@prisma/client";

export const PERMISOS = {
  ver: ["admin", "licitaciones", "comite", "consulta"],
  "comite.decidir": ["admin", "comite"],
  "radar.correr": ["admin", "licitaciones"],
  "buzon.revisar": ["admin", "licitaciones"],
  "ficha.rehacer": ["admin", "licitaciones", "comite"],
  "paquetes.editar": ["admin", "licitaciones"],
  "proveedores.invitar": ["admin", "licitaciones"],
  "usuarios.administrar": ["admin"],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export const puede = (rol: Rol | null | undefined, p: Permiso) => !!rol && (PERMISOS[p] as readonly Rol[]).includes(rol);

export const ROL: Record<Rol, { etiqueta: string; detalle: string }> = {
  admin: { etiqueta: "Administrador", detalle: "Todo, y maneja los usuarios" },
  licitaciones: { etiqueta: "Licitaciones", detalle: "Radar, buzón, paquetes, proveedores e invitaciones" },
  comite: { etiqueta: "Comité", detalle: "Decide si Conconcreto se presenta" },
  consulta: { etiqueta: "Consulta", detalle: "Ve todo, no cambia nada" },
};
