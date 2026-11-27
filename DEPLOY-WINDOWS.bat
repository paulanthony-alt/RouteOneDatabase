@echo off
rem Double-click this file to put the site online.
cd /d "%~dp0"
title Route One - putting the site online

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Get the LTS version from https://nodejs.org, install it, then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo Step 1 of 3: downloading what the site needs...
call npm install
if errorlevel 1 goto failed

echo.
echo Step 2 of 3: sign in to Google in the browser window that opens.
echo If it asks a question here, type y and press Enter.
call npx firebase login
if errorlevel 1 goto failed

echo.
echo Step 3 of 3: putting the site online...
call npm run deploy
if errorlevel 1 goto failed

echo.
echo Done! Your site is at https://routeonedatabase.web.app
echo.
pause
exit /b 0

:failed
echo.
echo Something went wrong. Take a screenshot of this window and send it to Claude.
echo.
pause
exit /b 1
