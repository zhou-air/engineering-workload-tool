$ErrorActionPreference = "Stop"
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $projectDirectory
try {
    python -m PyInstaller --noconfirm --clean --onedir --windowed --name WorkloadTool main.py
    $portableDirectory = Join-Path $projectDirectory "dist\WorkloadTool"
    New-Item -ItemType Directory -Force -Path (Join-Path $portableDirectory "data") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $portableDirectory "exports") | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectDirectory "README.md") -Destination $portableDirectory -Force
    Copy-Item -LiteralPath (Join-Path $projectDirectory "docs") -Destination $portableDirectory -Recurse -Force
    Write-Host "Portable build created at $portableDirectory"
}
finally {
    Pop-Location
}
