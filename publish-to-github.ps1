$ErrorActionPreference = "Stop"

$repo = "https://github.com/konnichiwa-akira/record-collection-map.git"
$branch = "main"

Write-Host "Publishing Record Collection Map to GitHub..." -ForegroundColor Cyan

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git が見つかりません。Git for Windows をインストールしてください。"
}

if (-not (Test-Path ".git")) {
    git init
    git branch -M $branch
    git remote add origin $repo
} else {
    $existing = git remote
    if ($existing -notcontains "origin") {
        git remote add origin $repo
    } else {
        git remote set-url origin $repo
    }
}

git add .
git commit -m "Publish record collection map"
git pull origin $branch --rebase
git push -u origin $branch

Write-Host ""
Write-Host "Push completed." -ForegroundColor Green
Write-Host "Next: GitHub Settings > Pages > Deploy from a branch > main / (root)"
