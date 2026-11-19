$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://127.0.0.1:5173/'
$appData = Join-Path $env:LOCALAPPDATA 'FluentPath'
$appServer = $null
$appBrowser = $null
$appLock = $null
$ownsLock = $false

try {
    $appLock = New-Object System.Threading.Mutex($false, 'Local\FluentPathLocalLauncher')
    try { $ownsLock = $appLock.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $ownsLock = $true }
    if (-not $ownsLock) {
        $appShell = New-Object -ComObject WScript.Shell
        [void]$appShell.AppActivate('FluentPath')
        exit 0
    }

    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    if (-not (Test-Path -LiteralPath (Join-Path $appRoot 'dist/index.html')) -or
        -not (Test-Path -LiteralPath (Join-Path $appRoot 'node_modules/tsx'))) {
        throw 'Run scripts/setup-local.ps1 once to install and build FluentPath.'
    }
    $browserPaths = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    )
    $browserPath = $browserPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $browserPath) { throw 'Install Microsoft Edge or Google Chrome to use the app shortcut.' }
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 5173)
    try { $listener.Start() } catch { throw 'Port 5173 is already in use. Close the existing local server, then open FluentPath again.' }
    finally { $listener.Stop() }

    [void](New-Item -ItemType Directory -Path $appData -Force)
    $appServer = Start-Process -FilePath $nodePath -ArgumentList '--import tsx server/index.ts --chatgpt-local' -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $appData 'server.log') -RedirectStandardError (Join-Path $appData 'server-error.log')
    $ready = $false
    $deadline = [DateTime]::UtcNow.AddSeconds(25)
    while ([DateTime]::UtcNow -lt $deadline -and -not $appServer.HasExited) {
        try {
            $session = Invoke-RestMethod -Uri ($appUrl + 'api/session') -TimeoutSec 2
            if ($session.authenticated -and -not $session.authEnabled) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw "The local server could not start. See $appData\server-error.log." }

    # A separate persistent browser profile gives this app its own process lifetime.
    # Disable browser background mode so closing its windows also stops the server.
    $profilePath = Join-Path $appData 'browser'
    $browserArgs = @("--app=$appUrl", "--user-data-dir=`"$profilePath`"", '--no-first-run', '--no-default-browser-check', '--disable-background-mode')
    $appBrowser = Start-Process -FilePath $browserPath -ArgumentList $browserArgs -WindowStyle Normal -PassThru
    while (-not $appBrowser.WaitForExit(1000)) {
        if ($appServer.HasExited) { throw "The local server stopped. See $appData\server-error.log, then reopen FluentPath." }
    }
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'FluentPath', 'OK', 'Error')
    exit 1
} finally {
    if ($appServer -and -not $appServer.HasExited) { Stop-Process -InputObject $appServer -ErrorAction SilentlyContinue }
    if ($ownsLock) { $appLock.ReleaseMutex() }
    if ($appLock) { $appLock.Dispose() }
}
