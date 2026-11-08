import { Barra } from "@/components/barra";
import { Contenedor, Encabezado, Vacio, BotonLink } from "@/components/ui";
import { IconoRadar } from "@/components/iconos";

export default function Inicio() {
  return (
    <>
      <Barra />
      <Contenedor className="py-10">
        <Encabezado et="Oportunidades" titulo="Lo que está en juego" bajada="Invitaciones privadas y procesos del SECOP, en un solo lugar, con su ficha de go/no-go." />
        <div className="mt-8">
          <Vacio icono={<IconoRadar className="size-5" />} titulo="Todavía no hay oportunidades" accion={<BotonLink href="/sistema" variante="primario">Ver el sistema de diseño</BotonLink>}>
            Entran de dos formas: el radar las encuentra en el SECOP, o alguien reenvía una invitación al buzón del agente.
          </Vacio>
        </div>
      </Contenedor>
    </>
  );
}
