param([switch]$InitializeAdmin)
$ErrorActionPreference = 'Stop'
$configKeys = @('JAVA_HOME', 'DB_URL', 'DB_USERNAME', 'DB_PASSWORD', 'SERVER_PORT', 'SESSION_COOKIE_SECURE')
$savedEnvironment = @{}
foreach ($key in ($configKeys + @('BOOTSTRAP_ADMIN_USERNAME', 'BOOTSTRAP_ADMIN_PASSWORD', 'BOOTSTRAP_ADMIN_ENABLED'))) {
    $savedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}
try {
    # Read literal KEY=value pairs. Never execute or expand file contents.
    $configPath = Join-Path $PSScriptRoot '.env.local'
    if (Test-Path -LiteralPath $configPath) {
        $lineNumber = 0
        foreach ($line in (Get-Content -LiteralPath $configPath -Encoding UTF8)) {
            $lineNumber++
            if ($line -match '^\s*(#|$)') { continue }
            if ($line -notmatch '^\s*([A-Z_]+)\s*=(.*)$') {
                throw "Invalid configuration at .env.local line $lineNumber. Expected KEY=value."
            }
            $key = $Matches[1]
            $value = $Matches[2].Trim()
            if ($key -notin $configKeys) { throw "Unsupported configuration key at .env.local line $lineNumber." }
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
    if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'D:\Java' }
    if (-not $env:DB_USERNAME) { $env:DB_USERNAME = 'ailearning_app' }
    if (-not $env:DB_PASSWORD) {
        $credential = Get-Credential -UserName $env:DB_USERNAME -Message '输入本地 MySQL 密码；配置 server/.env.local 后无需重复输入'
        $env:DB_PASSWORD = $credential.GetNetworkCredential().Password
    }
    if ($InitializeAdmin) {
        $adminName = Read-Host '首次网站管理员账号（3-64 位字母、数字、点、下划线或短横线）'
        $admin = Get-Credential -UserName $adminName -Message '设置网站管理员密码：至少 12 字符，最多 72 UTF-8 字节'
        $env:BOOTSTRAP_ADMIN_USERNAME = $admin.UserName
        $env:BOOTSTRAP_ADMIN_PASSWORD = $admin.GetNetworkCredential().Password
        $env:BOOTSTRAP_ADMIN_ENABLED = 'true'
    } else {
        $env:BOOTSTRAP_ADMIN_ENABLED = 'false'
    }
    Push-Location $PSScriptRoot
    try {
        # Clean stale class files when Java sources are renamed or deleted.
        & .\mvnw.cmd clean spring-boot:run
        $backendExitCode = $LASTEXITCODE
    } finally { Pop-Location }
} finally {
    foreach ($key in $savedEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($key, $savedEnvironment[$key], 'Process')
    }
    $credential = $null
    $admin = $null
}
exit $backendExitCode
