<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Licitaciones · Conconcreto

Lee `README.md` antes de tocar nada: ahí están el flujo, las reglas que no se tocan y cómo se verifica.

- `npm run check` antes de dar algo por terminado. `npm run e2e` si tocaste el buzón, los paquetes o las invitaciones.
- El sistema de diseño está en `src/components/ui.tsx` y la referencia viva en `/sistema`. Nada de colores ni radios a mano.
- El menú vive en `src/components/barra.tsx` (`NAV`) y en ningún otro sitio.
- Etiquetas de los enums: `src/lib/etiquetas.ts`.
- Una cifra que lea el comité la calcula el código, no el modelo.
- Español neutro con tuteo. Nada de voseo en textos ni en prompts.
