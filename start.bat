@echo off

title UniSense

color 0B

cls

echo ============================================
echo               UniSense
echo ============================================
echo.

cd /d %~dp0

echo Iniciando servidor...
echo.

start cmd /k "python run.py"

echo.
echo Sistema iniciado.
echo.

pause