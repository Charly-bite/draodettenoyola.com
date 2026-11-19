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
   - 🔄 2026-11-19: **Decisión: dejar Render y servir desde desarrollo (.218)** detrás de Cloudflare Tunnel (DNS ya está en Cloudflare). Render no permite cambiar Static→Web (`services[0].type: changing service type not supported`).
     - ✅ Clon en `desarrollo:...\02-plataformas-activas\dr-odette-web` (commit `7265602`), `.env` prod (`PORT=9996`, `WAOS_BRIDGE_URLS=http://127.0.0.1:6006`, `SKIP_GIT_PUSH=1`).
     - ✅ Tarea `DrOdette_Web_9996` (SYSTEM, al arranque, bucle de reinicio en `start_dr_odette_web.bat`, log `dr_odette_web.log`). Smoke test: `/` 200, `/server.js` `/.env` `/data/*` 404.
     - ✅ `cloudflared 2026.11.1` instalado (firma Cloudflare válida).
     - ✅ **EN PRODUCCIÓN desde 2026-11-19 ~13:45**: túnel Cloudflare `dr-odette-218` (ID `4662ba2a-e804-4aa6-a2b4-ccaf521adcfa`, servicio Windows `cloudflared` automático en .218). Rutas `draodettenoyola.com` y `www` → `http://localhost:9996`. DNS: ambos CNAME proxied al túnel.
       - Verificado externo: `/` y landings 200, `/server.js` `/.env` `/data/*` 404, http→https y www→apex 301, assets cacheados en Cloudflare.
       - Lección: Render registra los dominios como *custom hostname* en su Cloudflare for SaaS; mientras existan ahí, ganan sobre el DNS de la zona. Hubo que borrarlos en Render → Custom Domains.
     - ✅ Render Static Site `dra-odette-page` **suspendido** (no borrado). Rollback: Resume + re-agregar dominios + DNS `@ A 216.24.57.1` y `www CNAME dra-odette-page.onrender.com` (DNS only).
     - ✅ `bot\src\odette_waos_server.js`: `BRIDGE_TARGETS` → `127.0.0.1:9996` + office-pc (override con `ODETTE_BRIDGE_TARGETS`); respaldo `.bak-pre-tunnel-20261119`. bridge-sync probado: 403 sin/llave mala, 200 con la nueva.
     - ⏳ Rotar token del túnel (se pegó en el chat): Tunnel → Overview → Rotate token → reinstalar con `scratchpad\instalar_tunel.ps1`.
     - ⏳ `gh auth login` en .218 y quitar `SKIP_GIT_PUSH=1` del `.env` de `dr-odette-web` (publicar artículos desde /admin hace commit+push).
     - ✅ Auto-deploy: tarea `DrOdette_Web_Deploy` (SYSTEM, cada 5 min) corre `ops/deploy-218.ps1`: commit local de lo que escribe /admin → rebase sobre origin/main → npm ci si cambió el lock → reinicio + health check con rollback automático. Log: `deploy.log`. El sitio arranca con `ops/start-218.bat`.
     - ✅ `render.yaml` eliminado del repo; `multer` 2.x + `npm audit` = 0 vulnerabilidades; GA4 duplicado sin guard quitado de 4 páginas; `data/waos-bridge-cache.json` y `data/heatmap-events.json` ya no se versionan.
     - ✅ WAOS :6006 activo (tarea `Odette_WAOS_Clinical_6006` habilitada). Bug corregido en `resolveChromeExecutablePath` (elegía la Chrome más vieja de la caché → "Target closed"). QR llega a `/admin` vía bridge local.
     - ⏳ **Servidor MSSQL `qb-bd-ts` (192.168.2.187) apagado/inalcanzable** (sin ping/SSH/1433): WAOS responde por WhatsApp pero no guarda conversaciones/leads hasta que vuelva.
     - ⏳ Deploy key de GitHub en .218 para que el auto-deploy suba los artículos publicados desde /admin (hoy quedan como commits locales).
     - ⏳ Borrar la instancia del Blueprint `dra-odette-page` en Render (ya no hay `render.yaml`).
3. **GA4 Admin (552583570):** desvincular el Data Stream `15826596407` (Lunoto).
