@echo off
REM draodettenoyola.com - servidor Node en desarrollo (.218), origen del Cloudflare Tunnel "dr-odette-218".
REM Lo lanza la tarea programada DrOdette_Web_9996 (SYSTEM, al arranque). Si node se cae, reinicia en 5 s.
cd /d "%~dp0.."
:loop
echo [%date% %time%] arrancando server.js >> dr_odette_web.log
"C:\Program Files\nodejs\node.exe" server.js >> dr_odette_web.log 2>&1
echo [%date% %time%] server.js termino (code %errorlevel%), reinicio en 5s >> dr_odette_web.log
timeout /t 5 /nobreak > nul
goto loop
