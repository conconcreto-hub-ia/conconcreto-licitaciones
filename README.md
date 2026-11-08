# Licitaciones · Conconcreto

De la invitación o el SECOP al cuadro comparativo, con un agente que hace el trabajo de en medio.
Conconcreto x irrelevant · programa Think AI, 2026.

## El flujo

```
PUERTA A · invitación privada            PUERTA B · SECOP
Outlook ──reenvía──▶ licitaciones@        Radar diario (Croma) con los criterios de Conconcreto
         (AgentMail)                       │
         │                                 ▼
         ▼                                Ficha de go/no-go con el mercado (cifras por código)
Oportunidad + ficha + acuse en el hilo     │
         └────────────┬────────────────────┘
                      ▼
           Comité aprueba o descarta (persona)
                      ▼ (en el SECOP: se reenvían los pliegos al buzón con el código)
           Paquetes: el agente propone, el código verifica que no falte ninguna actividad,
           los suministros de concreto / acero / bloques se consolidan, licitaciones confirma
                      ▼
           BIMBAU por paquete (plantilla oficial) + control de asignación con memoria de cálculo
                      ▼
           Proveedores: base de Conconcreto + directorio del SECOP, verificados (sanciones, contratos)
                      ▼
           Invitaciones en borrador → licitaciones aprueba → salen con el BIMBAU adjunto
                      ▼
           Respuestas en el hilo: cotización (total calculado por código), pregunta o declinación
           Recordatorios a los que no contestan · tablero de paquetes en riesgo
                      ▼
           Cuadro comparativo. El agente no adjudica: decide una persona.
```

## Correr

```bash
npm install
npx prisma db push && npx prisma generate
npx tsx scripts/sembrar.ts        # criterios y remitentes autorizados
npm run dev                        # http://localhost:3010
```

`.env.local` (fuera de git): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CROMA_API_KEY`, `AGENTMAIL_API_KEY`,
`AGENTMAIL_INBOX`, `ENVIO_DOMINIOS_PERMITIDOS`, `CRON_SECRET`, `AGENTMAIL_WEBHOOK_TOKEN`.

**Después de cambiar `prisma/schema.prisma`: `npx prisma generate` y reiniciar el servidor.** El cliente de
Prisma queda cargado en memoria y un servidor viejo sigue con el cliente viejo.

## Verificar

```bash
npm run check   # typecheck + tests (segundos)
npm run e2e     # de punta a punta con buzones reales de AgentMail (unos 3 minutos, gasta API)
```

Qué prueba cada cosa: `scripts/README.md`.

## Las reglas que no se tocan

- **Modo prueba.** El agente solo envía correos a `ENVIO_DOMINIOS_PERMITIDOS` (hoy `agentmail.to`). Los
  proveedores reales que encuentra en el SECOP quedan verificados pero en borrador. Abrirlo es una decisión.
- **Nada sale sin una persona.** El comité decide si se cotiza; licitaciones confirma los paquetes y aprueba
  las invitaciones. El agente no adjudica.
- **Lo que llega de afuera no manda.** Solo los remitentes autorizados abren oportunidades. Lo que escribe
  un cliente o un proveedor es material a leer: si pide algo al sistema, no se obedece.
- **Los números los hace el código.** Las cifras del mercado, la consolidación de suministros y los totales
  de las cotizaciones. El modelo interpreta y redacta.
- **`extracted_text` de AgentMail quita lo citado.** En un reenvío lo citado ES la invitación: se lee `text`.
- **Responder a un correo propio sin `to` se lo manda al mismo buzón.** Los recordatorios dicen a quién van.

## Las rutinas

| Qué | Cuándo | Desplegado | En un computador |
|---|---|---|---|
| Radar del SECOP + fichas | L-V 7:00 | `GET /api/cron/radar` (vercel.json) | `npx tsx scripts/rutinas.ts` |
| Recordatorios (48 h sin respuesta) | L-V 8:00 | `GET /api/cron/recordatorios` | ídem |
| Buzón | al llegar un correo | webhook de AgentMail → `POST /api/webhooks/agentmail?token=…` | cada 3 min de 7 a 19, solo si hay correo nuevo |

Las rutas de cron piden `Authorization: Bearer $CRON_SECRET`. El buzón no se sondea de noche para que la
base (Neon) pueda dormir: se cobra por hora encendida.

## Antes de desplegar

1. **Inicio de sesión.** Hoy no hay: cualquiera con el enlace vería las oportunidades y podría enviar
   invitaciones. Va primero.
2. **Dónde vive.** Con datos de clientes y proveedores de una empresa que cotiza en bolsa, lo decide TI de
   Conconcreto (su infraestructura, o Vercel + Neon con aprobación).
3. **Abrir el envío** a los dominios reales, a propósito, y registrar el webhook de AgentMail.
