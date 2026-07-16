$ErrorActionPreference = "Stop"
$repoDir = "D:\BaiduSyncdisk\workspace\milkio"
Set-Location $repoDir

$maxPatch = 20
$currentPatch = 16

function Get-CIStatus {
    try {
        $response = Invoke-WebRequest -Uri "https://github.com/akirarika/milkio/actions/workflows/publish-main.yml" -UseBasicParsing -TimeoutSec 15
        # Look for the latest run status in the HTML
        if ($response.Content -match 'class="ActionList-item-label"[^>]*>([^<]+)</span>') {
            $status = $matches[1].Trim()
            return $status
        }
        if ($response.Content -match '"status":"([^"]+)"') {
            return $matches[1]
        }
        return "unknown"
    } catch {
        return "fetch_failed"
    }
}

function Get-LatestRunStatus {
    try {
        $response = Invoke-WebRequest -Uri "https://github.com/akirarika/milkio/actions/runs?page=1" -UseBasicParsing -TimeoutSec 15
        $content = $response.Content
        # Look for conclusion/status patterns in the HTML
        if ($content -match '"conclusion":"([^"]+)"') {
            return $matches[1]
        }
        if ($content -match '"status":"([^"]+)"') {
            return $matches[1]
        }
        if ($content -match 'check-run-(success|failure|pending)') {
            return $matches[1]
        }
        return "unknown"
    } catch {
        return "fetch_failed"
    }
}

function Publish-Version {
    param([int]$patch)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 发布 1.3.$patch..."
    try {
        $result = bun .publ.ts "1.3.$patch" 2>&1
        $output = $result -join "`n"
        Write-Host $output
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌ bun .publ.ts 失败，exit code: $LASTEXITCODE"
            return $false
        }
        # Check if push was successful
        if ($output -match "已推送") {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ 已推送 v1.3.$patch"
            return $true
        } else {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️ 可能未成功推送"
            return $false
        }
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌ 发布异常: $_"
        return $false
    }
}

# Phase 1: Wait 15 minutes, then publish 1.3.16
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⏳ 等待 15 分钟后发布 1.3.16..."
Start-Sleep -Seconds (15 * 60)

$result = Publish-Version -patch $currentPatch
if (-not $result) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌ 1.3.16 发布失败，继续重试流程"
}

# Phase 2: Loop check and retry
while ($currentPatch -le $maxPatch) {
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] ====== 检查 CI 状态（1.3.$currentPatch）======"

    # Wait 5 minutes before checking
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⏳ 等待 5 分钟后检查 CI..."
    Start-Sleep -Seconds (5 * 60)

    $status = Get-LatestRunStatus
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 📊 CI 状态: $status"

    if ($status -eq "success") {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ CI