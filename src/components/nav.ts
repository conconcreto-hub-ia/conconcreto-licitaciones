// El menú de esta app: vive aquí y en ningún otro sitio. La barra lateral (barra-cliente.tsx) es la misma
// en las cuatro apps; lo que cambia es esto.
import type { IconoMenu } from "./iconos-menu";

export const APP = { nombre: "Licitaciones", descripcion: "Del SECOP y las invitaciones al cuadro comparativo" };

export type ItemNav = { href: string; etiqueta: string; icono: IconoMenu; soloAdmin?: boolean; tambien?: string[] };

export const NAV: ItemNav[] = [
  { href: "/", etiqueta: "Oportunidades", icono: "inicio", tambien: ["/oportunidades", "/paquetes"] },
  { href: "/radar", etiqueta: "Radar SECOP", icono: "radar" },
  { href: "/buzon", etiqueta: "Buzón", icono: "buzon" },
  { href: "/proveedores", etiqueta: "Proveedores", icono: "proveedores" },
  { href: "/criterios", etiqueta: "Criterios", icono: "criterios" },
  { href: "/usuarios", etiqueta: "Usuarios", icono: "usuarios", soloAdmin: true },
];
