# Scripts

| Script | Qué hace |
|---|---|
| `sembrar.ts` | Criterios iniciales del radar y remitentes autorizados. Idempotente. |
| `radar.ts` | Corre el radar del SECOP una vez (lo que llama la rutina diaria). |
| `ficha.ts [código]` | Arma la ficha de go/no-go de una oportunidad, o de todas las que no tienen. |
| `buzon.ts` | Revisa el buzón del agente una vez. |
| `e2e.ts` | Prueba de punta a punta, parte 1: invitación, tercero no autorizado, comité, pliegos, paquetes. |
| `e2e-proveedores.ts` | Parte 2: proveedores, envío, respuestas, recordatorio y cuadro. Corre después de `e2e.ts`. |
| `rutinas.ts` | Las rutinas en un computador: radar 7:00, recordatorios 8:00, buzón cada 3 min solo si hay correo nuevo. |

Las pruebas usan buzones reales de AgentMail (`prueba-*-cc@agentmail.to`). El plan permite 5 buzones:
el del agente, Jhon, el tercero (que también hace de proveedor C) y dos proveedores.

**Modo prueba:** `ENVIO_DOMINIOS_PERMITIDOS="agentmail.to"` en `.env.local`. El agente no le escribe a
nadie fuera de esos dominios. Abrirlo a proveedores reales es una decisión, no un cambio de rutina.
