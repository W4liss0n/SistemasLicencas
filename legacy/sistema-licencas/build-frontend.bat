@echo off
title Sistema de Licencas - Build Frontend

REM ========================================
REM   Build Frontend - Sistema de Licencas
REM ========================================

cd /d "%~dp0"

echo.
echo ====================================================
echo      Sistema de Licencas - Build Frontend
echo ====================================================
echo.

REM Verificar se Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado
    echo Por favor, instale o Node.js: https://nodejs.org/
    pause
    exit /b 1
)

REM Verificar se pasta web existe
if not exist "web" (
    echo [ERRO] Pasta web nao encontrada
    pause
    exit /b 1
)

echo [INFO] Fazendo build do frontend
echo [INFO] Isso pode levar 1-2 minutos
echo.

REM Entrar na pasta web e fazer build
cd web
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao buildar frontend
    pause
    exit /b 1
)

cd ..

echo.
echo ====================================================
echo      BUILD CONCLUIDO COM SUCESSO
echo ====================================================
echo   Arquivos buildados em: web\dist\
echo.
echo   Para aplicar as mudancas:
echo   1. Pare o servidor (stop-sistema.bat)
echo   2. Inicie novamente (start-sistema.bat)
echo ====================================================
echo.

pause
