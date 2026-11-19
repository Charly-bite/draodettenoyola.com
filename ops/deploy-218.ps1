# Auto-deploy de draodettenoyola.com en desarrollo (.218).
# Lo ejecuta la tarea programada DrOdette_Web_Deploy (SYSTEM, cada 5 min).
#  1. Hace commit local de lo que el panel /admin escribio (articulos, imagenes, sitemap).
#  2. Trae origin/main y hace rebase de esos commits encima.
#  3. Si hubo codigo nuevo: npm ci (si cambio el lockfile), reinicia el servidor y verifica salud.
#     Si el servidor no responde, regresa al commit anterior y reinicia.
#  4. Si hay commits locales y el push esta configurado (deploy key), los sube a GitHub.
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$log  = Join-Path $repo 'deploy.log'
$task = 'DrOdette_Web_9996'
$port = 9996
$g    = @('-c', "safe.directory=$($repo -replace '\\','/')", '-C', $repo)

function Write-Log($m) { "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m | Add-Content -Path $log -Encoding utf8 }
function Invoke-Git { & git @g @args 2>&1 | ForEach-Object { "$_" } }
function Test-Site {
  for ($i = 0; $i -lt 15; $i++) {
    try { if ((Invoke-WebRequest "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { return $true } } catch {}
    Start-Sleep 2
  }
  return $false
}
function Restart-Site([bool]$npm) {
  Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  if ($npm) {
    Push-Location $repo
    $out = & npm ci --omit=dev --no-audit --no-fund 2>&1 | Select-Object -Last 2
    Pop-Location
    Write-Log "npm ci: $($out -join ' | ')"
  }
  Start-ScheduledTask -TaskName $task
  return (Test-Site)
}

# Evitar dos despliegues a la vez
$lock = Join-Path $repo '.deploy.lock'
if ((Test-Path $lock) -and ((Get-Date) - (Get-Item $lock).LastWriteTime).TotalMinutes -lt 20) { exit 0 }
New-Item -ItemType File -Force $lock | Out-Null
try {
  # 1) contenido escrito por /admin
  if (Invoke-Git status --porcelain) {
    Invoke-Git add -A | Out-Null
    Invoke-Git commit -q -m "content: cambios desde /admin en .218 ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))" | Out-Null
    Write-Log 'commit local de contenido del admin'
  }

  # 2) codigo nuevo en GitHub
  $fetch = Invoke-Git fetch -q origin main
  if ($LASTEXITCODE -ne 0) { Write-Log "ERROR fetch: $fetch"; exit 1 }
  $before = (Invoke-Git rev-parse HEAD)
  $base   = (Invoke-Git merge-base HEAD origin/main)
  $remote = (Invoke-Git rev-parse origin/main)
  if ($remote -ne $base) {
    $oldLock = (Invoke-Git rev-parse 'HEAD:package-lock.json')
    $rb = Invoke-Git rebase -q origin/main
    if ($LASTEXITCODE -ne 0) {
      Invoke-Git rebase --abort | Out-Null
      Write-Log "ERROR rebase con conflicto, se dejo como estaba: $rb"
      exit 1
    }
    $newLock = (Invoke-Git rev-parse 'HEAD:package-lock.json')
    $after = (Invoke-Git rev-parse --short HEAD)
    Write-Log "actualizado $($before.Substring(0,7)) -> $after"
    if (Restart-Site ($oldLock -ne $newLock)) {
      Write-Log "OK servidor responde en :$port"
    } else {
      Write-Log "ERROR servidor no responde tras desplegar $after; regresando a $($before.Substring(0,7))"
      Invoke-Git reset -q --hard $before | Out-Null
      if (Restart-Site ($oldLock -ne $newLock)) { Write-Log 'rollback OK' } else { Write-Log 'ERROR rollback: el servidor sigue sin responder' }
    }
  }

  # 3) subir commits locales (solo si hay deploy key configurada)
  $ahead = [int](Invoke-Git rev-list --count origin/main..HEAD)
  if ($ahead -gt 0 -and (Invoke-Git config --get core.sshCommand)) {
    $push = Invoke-Git push -q origin HEAD:main
    if ($LASTEXITCODE -eq 0) { Write-Log "push de $ahead commit(s) OK" } else { Write-Log "ERROR push: $push" }
  }
} finally {
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
}
