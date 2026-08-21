$jsonPath = "C:\Users\CarlosAlbertoAcevesC\Desktop\Orchestrator\projects.json"
if (Test-Path $jsonPath) {
    $data = Get-Content -Path $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $exists = $data.projects | Where-Object { $_.id -eq "dra-odette" }
    if (-not $exists) {
        $newProject = [pscustomobject]@{
            id = "dra-odette"
            name = "Dra. Odette (Materno Fetal)"
            description = "Sitio Web Medico Oficial - Ginecologia y Medicina Materno Fetal"
            path = "C:/Users/CarlosAlbertoAcevesC/NewDraPage"
            command = "powershell.exe -ExecutionPolicy Bypass -File start-dev.ps1"
            port = 9996
            host = "0.0.0.0"
            external_ip = "192.168.2.222"
            health_check = "/index.html"
            color = "#0D7A75"
            requires_admin = $false
            environment = "dev"
        }
        $data.projects += $newProject
        $data | ConvertTo-Json -Depth 10 | Set-Content -Path $jsonPath -Encoding UTF8
        Write-Host "Dra. Odette ha sido registrado exitosamente en Merlin (Port 9996)!" -ForegroundColor Green
    } else {
        # Update path and configuration if already exists
        $exists.name = "Dra. Odette (Materno Fetal)"
        $exists.description = "Sitio Web Medico Oficial - Ginecologia y Medicina Materno Fetal"
        $exists.path = "C:/Users/CarlosAlbertoAcevesC/NewDraPage"
        $exists.command = "powershell.exe -ExecutionPolicy Bypass -File start-dev.ps1"
        $exists.port = 9996
        $exists.host = "0.0.0.0"
        $exists.external_ip = "192.168.2.222"
        $exists.health_check = "/index.html"
        $exists.color = "#0D7A75"
        $exists.requires_admin = $false
        $exists.environment = "dev"
        $data | ConvertTo-Json -Depth 10 | Set-Content -Path $jsonPath -Encoding UTF8
        Write-Host "Configuracion de Dra. Odette actualizada en Merlin (Port 9996)!" -ForegroundColor Green
    }
} else {
    Write-Host "No se encontro el archivo de configuracion de Merlin en $jsonPath" -ForegroundColor Red
}
