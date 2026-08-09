$files = @('js\auth.js','js\app.js','js\dashboard.js','js\documents.js','js\upload.js','js\members.js')
foreach ($f in $files) {
    $c = Get-Content $f -Raw
    # Replace bare 'supabase' variable references (not URLs, not comments text, not compound words)
    $c = $c -replace '(?<![a-zA-Z0-9_])supabase(?!Client|\.co|-js|URL|KEY|_)', 'supabaseClient'
    Set-Content $f $c -NoNewline
    Write-Host "Updated: $f"
}
Write-Host "All done!"
