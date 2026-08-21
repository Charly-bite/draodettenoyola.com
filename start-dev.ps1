# Iniciar servidor de desarrollo para Dra. Odette en puerto 9996
Write-Host "Iniciando servidor de Dra. Odette en http://localhost:9996 ..." -ForegroundColor Cyan
npx -y http-server . -p 9996 -a 0.0.0.0 -c-1
