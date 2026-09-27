@echo off
title Keyword Library
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and start this again.
  pause
  exit /b 1
)
node server.mjs
if errorlevel 1 pause
