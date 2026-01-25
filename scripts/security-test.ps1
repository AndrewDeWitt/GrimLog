# Security API Tests for TacLog
# Run this while dev server is running: npm run dev
# Usage: .\scripts\security-test.ps1

$BASE_URL = "http://localhost:3000"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TACLOG API SECURITY TESTS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Description,
        [int]$ExpectedStatus,
        [string]$Body = $null
    )
    
    Write-Host "Testing: $Description" -ForegroundColor Yellow
    Write-Host "  $Method $Endpoint"
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        $params = @{
            Method = $Method
            Uri = "$BASE_URL$Endpoint"
            Headers = $headers
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = $Body
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing
        $status = $response.StatusCode
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        if (-not $status) { $status = 0 }
    }
    
    if ($status -eq $ExpectedStatus) {
        Write-Host "  ✅ PASS: Got $status (expected $ExpectedStatus)" -ForegroundColor Green
        $script:passed++
    }
    else {
        Write-Host "  ❌ FAIL: Got $status (expected $ExpectedStatus)" -ForegroundColor Red
        $script:failed++
    }
    Write-Host ""
}

Write-Host "=== CRITICAL: LLM/Expensive Endpoints (Should require auth) ===" -ForegroundColor Magenta
Write-Host ""

# Dossier Submit - Most expensive endpoint
Test-Endpoint -Method "POST" -Endpoint "/api/dossier/submit" `
    -Description "Dossier Submit (no auth)" `
    -ExpectedStatus 401 `
    -Body '{"armyListText":"test"}'

# Army Parse - Uses AI
Test-Endpoint -Method "POST" -Endpoint "/api/armies/parse" `
    -Description "Army Parse (no auth)" `
    -ExpectedStatus 401

# Spirit Icon Generation - Image generation
Test-Endpoint -Method "POST" -Endpoint "/api/dossier/generate-spirit-icon" `
    -Description "Spirit Icon Generation (no auth)" `
    -ExpectedStatus 401 `
    -Body '{"imagePrompt":"test","tagline":"test","faction":"test"}'

# Stat Icons Generation - Multiple image generations
Test-Endpoint -Method "POST" -Endpoint "/api/dossier/generate-stat-icons" `
    -Description "Stat Icons Generation (no auth)" `
    -ExpectedStatus 401 `
    -Body '{"stats":[],"faction":"test"}'

# Tactical Advisor - AI endpoint
Test-Endpoint -Method "POST" -Endpoint "/api/tactical-advisor" `
    -Description "Tactical Advisor (no auth)" `
    -ExpectedStatus 401 `
    -Body '{"sessionId":"test","phase":"Command"}'

# Main Analyze endpoint - AI processing
Test-Endpoint -Method "POST" -Endpoint "/api/analyze" `
    -Description "Main Analyze (no auth)" `
    -ExpectedStatus 401

Write-Host "=== ADMIN Endpoints (Should require admin) ===" -ForegroundColor Magenta
Write-Host ""

Test-Endpoint -Method "GET" -Endpoint "/api/admin/users" `
    -Description "Admin Users List (no auth)" `
    -ExpectedStatus 401

Test-Endpoint -Method "PATCH" -Endpoint "/api/admin/users/fake-id/credits" `
    -Description "Admin Adjust Credits (no auth)" `
    -ExpectedStatus 401 `
    -Body '{"credits":10}'

Test-Endpoint -Method "GET" -Endpoint "/api/admin/factions" `
    -Description "Admin Factions (no auth)" `
    -ExpectedStatus 401

Test-Endpoint -Method "POST" -Endpoint "/api/admin/datasheets" `
    -Description "Admin Create Datasheet (no auth)" `
    -ExpectedStatus 401 `
    -Body '{}'

Write-Host "=== Protected User Endpoints ===" -ForegroundColor Magenta
Write-Host ""

Test-Endpoint -Method "GET" -Endpoint "/api/sessions" `
    -Description "Sessions List (no auth)" `
    -ExpectedStatus 401

Test-Endpoint -Method "POST" -Endpoint "/api/sessions" `
    -Description "Create Session (no auth)" `
    -ExpectedStatus 401 `
    -Body '{}'

Test-Endpoint -Method "GET" -Endpoint "/api/armies" `
    -Description "Armies List (no auth)" `
    -ExpectedStatus 401

Test-Endpoint -Method "POST" -Endpoint "/api/armies" `
    -Description "Create Army (no auth)" `
    -ExpectedStatus 401 `
    -Body '{"name":"test"}'

Test-Endpoint -Method "GET" -Endpoint "/api/secondaries" `
    -Description "Secondaries (no auth)" `
    -ExpectedStatus 401

Test-Endpoint -Method "GET" -Endpoint "/api/users/credits" `
    -Description "User Credits (no auth)" `
    -ExpectedStatus 401

Write-Host "=== Intentionally PUBLIC Endpoints (Should allow access) ===" -ForegroundColor Magenta
Write-Host ""

Test-Endpoint -Method "GET" -Endpoint "/api/factions" `
    -Description "Factions List (public)" `
    -ExpectedStatus 200

Test-Endpoint -Method "GET" -Endpoint "/api/datasheets" `
    -Description "Datasheets List (public read)" `
    -ExpectedStatus 200

# Missions is protected (requires auth) - that's correct!
Test-Endpoint -Method "GET" -Endpoint "/api/missions" `
    -Description "Missions (protected)" `
    -ExpectedStatus 401

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failed -gt 0) {
    Write-Host "⚠️  SECURITY ISSUES DETECTED!" -ForegroundColor Red
    Write-Host "Some endpoints are not properly protected." -ForegroundColor Red
    exit 1
}
else {
    Write-Host "✅ All security tests passed!" -ForegroundColor Green
    exit 0
}

