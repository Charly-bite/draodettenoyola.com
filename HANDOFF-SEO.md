# HANDOFF AGY → Claude Code — pestaña SEO (draodettenoyola.com) — 2026-11-19 ~12:30

Swarm AGY "Auditoría SEO, GEO y código draodettenoyola.com" (conversación `f67c0c13-4f6b-44c1-bc7c-99b2a43effb8`). **La parte de código está TERMINADA**; la cuota se agotó después del resumen final. El aviso "monitor failed" es solo el monitor sin cuota.

## Hecho (verificado)
- Commit **`9e37535`** en `main` = `origin/main` (https://github.com/Charly-bite/draodettenoyola.com.git): allowlist del servidor, auth de API, sin llaves fallback en `api/waos.js` y `api/heatmap.js`, `llms.txt`, grafo JSON-LD E-E-A-T, FAQPage en 7/7 guías de `/blog/`, handoff de reservas por WhatsApp.
- Fuera del commit a propósito: `data/waos-bridge-cache.json` (modificado), `.dory-icon.ico`, `.folder-icon.ico`, `desktop.ini`.
- Documentos:
  - Auditoría: `C:\Users\CarlosAlbertoAcevesC\.gemini\antigravity-cli\brain\f67c0c13-4f6b-44c1-bc7c-99b2a43effb8\auditoria_seo_geo_draodettenoyola.md`
  - Kit Copy-Paste (Doctoralia + GBP + Doctosan): `...\brain\f67c0c13-4f6b-44c1-bc7c-99b2a43effb8\kit_doctoralia_gbp_odette.md`

## Pendiente (pasos manuales en consolas externas)
1. **Render Dashboard:** cambiar el servicio de *Static Site* a *Web Service* Node (`node server.js`, según `render.yaml`) y cargar env vars: `ODETTE_BRIDGE_KEY`, `HEATMAP_SYNC_KEY`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `WAOS_BRIDGE_URLS`, `GROQ_API_KEY`.
   ⚠ Mientras siga como Static Site, `/server.js` y `/data/*` se sirven públicamente.
2. **desarrollo:6006** (`odette_waos_server.js:19-133`): rotar `ODETTE_BRIDGE_KEY`, mover `GROQ_API_KEY` / `DB_PASSWORD` a `.env`, re-escanear QR de WhatsApp cuando `/admin` esté activo.
   - ✅ 2026-11-19 (Claude Code): `ODETTE_BRIDGE_KEY` rotada (32 bytes aleatorios) en `desarrollo:bot\.env` (respaldo `.env.bak-pre-rotate-20261119`) y en el `.env` local de DEVQB (:9996). La llave vieja estaba en el historial público de GitHub (`api/waos.js`) → ya no sirve.
   - ✅ `src/odette_waos_server.js` vivo ya leía `GROQ_API_KEY` / `DB_PASSWORD` / `ODETTE_BRIDGE_KEY` solo de `.env`; no hay valores hardcodeados.
   - ⏳ Render: poner `ODETTE_BRIDGE_KEY` = el valor de la línea `ODETTE_BRIDGE_KEY=` del `.env` local (hace falta el punto 1).
   - ⏳ Groq: revocar la `GROQ_API_KEY` actual y poner la nueva en `desarrollo:bot\.env` (estuvo hardcodeada en `.bak-pre-wp0\src\odette_waos_server.js` y `.bak-pre-wp0\src\utils\llm.js`).
   - ⏳ La tarea programada `Odette_WAOS_Clinical_6006` está **Disabled** y no hay nada escuchando en :6006 → habilitarla o arrancarla, y escanear el QR en `/admin`.
3. **GA4 Admin (552583570):** desvincular el Data Stream `15826596407` (Lunoto).
