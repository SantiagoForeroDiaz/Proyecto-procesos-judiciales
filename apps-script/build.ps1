$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryDirectory = Split-Path -Parent $scriptDirectory
$sourceHtmlPath = Join-Path $repositoryDirectory 'index.html'
$sourceCssPath = Join-Path $repositoryDirectory 'styles.css'
$sourceJsPath = Join-Path $repositoryDirectory 'app.js'
$outputPath = Join-Path $scriptDirectory 'Index.html'

$bundle = [System.IO.File]::ReadAllText($outputPath)
$authMarkupMatch = [regex]::Match($bundle, '(?s)<main id="authGate".*?</main>')
$authScriptMatch = [regex]::Match($bundle, '(?s)const ACCESS_SESSION_KEY = .*?</script>')
if (-not $authMarkupMatch.Success -or -not $authScriptMatch.Success) {
  throw 'No se encontró el bloque de autenticación en apps-script\Index.html.'
}

$html = [System.IO.File]::ReadAllText($sourceHtmlPath)
$css = [System.IO.File]::ReadAllText($sourceCssPath)
$appJs = [System.IO.File]::ReadAllText($sourceJsPath)
$authScript = $authScriptMatch.Value -replace '</script>$', ''
$html = $html.Replace('<link rel="stylesheet" href="styles.css">', "<style>`r`n$css`r`n</style>")
$html = $html.Replace('<body>', '<body class="auth-pending">' + $authMarkupMatch.Value)
$html = $html.Replace('<script src="app.js"></script>', "<script>`r`n$appJs`r`n$authScript`r`n</script>")

if ($html -match '<link rel="stylesheet" href="styles.css">' -or $html -match '<script src="app.js"></script>') {
  throw 'No se pudieron incrustar los recursos locales en Index.html.'
}

[System.IO.File]::WriteAllText($outputPath, $html, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Se generó apps-script\Index.html.'
