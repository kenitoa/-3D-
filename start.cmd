@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.22.3 or later is required. https://nodejs.org/
  pause
  exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&(v[1]>22||(v[1]===22&&v[2]>=3)))?0:1)"
if errorlevel 1 (
  echo Node.js 22.22.3 or later is required. https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules\babylonjs\babylon.js (
  call npm.cmd ci --ignore-scripts
  if errorlevel 1 goto failed
)
call npm.cmd run build
if errorlevel 1 goto failed
set "campus_launch_port=%PORT%"
if not defined campus_launch_port set "campus_launch_port=8765"
echo Open http://127.0.0.1:%campus_launch_port%/ if the browser does not start.
node scripts\serve.mjs --dist --platform --open
if errorlevel 1 goto failed
exit /b 0
:failed
echo Launch failed. Check the message above.
pause
exit /b 1
