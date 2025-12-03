@echo off
echo Clearing GitHub credentials...
cmdkey /delete:git:https://github.com 2>nul
cmdkey /delete:git:https://github.com/Ratan7408 2>nul

echo Updating remote URL...
git remote set-url origin https://Ratan7408@github.com/Ratan7408/anime_india_backened.git

echo.
echo Now pushing to GitHub...
echo When prompted, enter your GitHub Personal Access Token as the password
echo.
git push -u origin main

pause

