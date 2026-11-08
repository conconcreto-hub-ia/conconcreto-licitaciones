# Plantillas

`Bimbau_Plantilla.xlsx` es la plantilla oficial de BIMBAU que usa Conconcreto. Viene del skill `separar-paquetes-cotizacion` de Jhon Bedoya (Ofertas y Presupuestos), entregado en la sesión 2 del programa.

- Hoja `Items_Ofertar`: proyecto en D5, duración en D6, encabezados en la fila 11; filas 12 (capítulo) y 13 (ítem) son los modelos de formato.
- Hojas ocultas `Fecha` y `Puntaje`: no se tocan.

Si la plantilla cambia, se reemplaza este archivo. `src/lib/bimbau.ts` la usa; si falta, genera un formato equivalente.
