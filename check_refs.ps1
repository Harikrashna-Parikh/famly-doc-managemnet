$files = @('js\auth.js','js\app.js','js\dashboard.js','js\documents.js','js\upload.js','js\members.js')
$found = $false
foreach ($f in $files) {
    $lines = Get-Content $f
    $lineNum = 0
    foreach ($line in $lines) {
        $lineNum++
        # Match 'supabase' that is NOT 'supabaseClient', not in URLs/comments about Supabase text
        if ($line -match '(?<![a-zA-Z0-9_])supabase(?!Client|\.co|-js|URL|KEY|_| is | Storage| Auth| client| URL)') {
            Write-Host "${f}:${lineNum}: $line"
            $found = $true
        }
    }
}
if (-not $found) {
    Write-Host "OK - No bare 'supabase' references found in JS files."
}
