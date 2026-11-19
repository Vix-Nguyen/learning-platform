$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
Push-Location $appRoot
try {
    $nodeVersion = & node.exe -p 'parseInt(process.versions.node)'
    if ($LASTEXITCODE -ne 0 -or [int]$nodeVersion -lt 24) { throw 'Install Node.js 24 or newer first.' }
    if (-not (Test-Path -LiteralPath 'node_modules/tsx') -or -not (Test-Path -LiteralPath 'node_modules/vite')) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    }
    & npm.cmd run build -- --base / --mode chatgpt-local
    if ($LASTEXITCODE -ne 0) { throw 'The local app build failed.' }

    $appShell = New-Object -ComObject WScript.Shell
    $shortcutFolders = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))
    foreach ($folder in $shortcutFolders) {
        $shortcut = $appShell.CreateShortcut((Join-Path $folder 'FluentPath.lnk'))
        $shortcut.TargetPath = Join-Path $env:WINDIR 'System32/wscript.exe'
        $shortcut.Arguments = '"' + (Join-Path $PSScriptRoot 'launch-local.vbs') + '"'
        $shortcut.WorkingDirectory = $appRoot
        $shortcut.Description = 'Start the local IELTS coach; stops its server when closed.'
        $shortcut.IconLocation = (Get-Command node.exe).Source + ',0'
        $shortcut.Save()
    }
    Write-Output 'FluentPath is ready on your Desktop and Start menu. Nothing was added to Windows startup.'
} finally { Pop-Location }
