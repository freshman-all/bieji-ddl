param(
  [string]$GitHubUser = "freshman-all",
  [string]$RepoName = "bieji-ddl"
)

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$safe = "safe.directory=" + $repo.Replace('\', '/')
$remote = "https://github.com/$GitHubUser/$RepoName.git"

Write-Host "Repository folder: $repo"
Write-Host "Remote: $remote"
Write-Host ""
Write-Host "Before running this script, create a public empty repository named '$RepoName' at https://github.com/new"
Read-Host "Press Enter after the GitHub repository has been created"

$existingRemote = git -c $safe -C $repo remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
  git -c $safe -C $repo remote set-url origin $remote
} else {
  git -c $safe -C $repo remote add origin $remote
}

git -c $safe -C $repo push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "Push failed. Sign in with Git Credential Manager when prompted, then run the script again." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Push complete: https://github.com/$GitHubUser/$RepoName" -ForegroundColor Green
Write-Host "Next: open repository Settings, Pages, Deploy from branch main, root folder."
