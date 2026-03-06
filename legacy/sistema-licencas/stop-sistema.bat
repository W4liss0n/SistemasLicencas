@echo off
title Sistema de Licencas - Parando Servicos...

REM ========================================
REM   Sistema de Licencas - Parar Servicos
REM ========================================

echo.
echo ====================================================
echo      Sistema de Licencas - Parar Servicos
echo ====================================================
echo.

echo [INFO] Procurando processos do sistema...
echo.

REM Listar processos Node.js relacionados ao sistema
set "FOUND=0"

REM Procurar processos com "npm" ou "node" que estejam rodando tsx ou vite
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo list ^| findstr /i "PID:"') do (
    set "FOUND=1"
)

if "%FOUND%"=="0" (
    echo [INFO] Nenhum processo do sistema encontrado.
    echo O sistema nao esta em execucao.
    goto :END
)

echo [INFO] Processos encontrados. Encerrando...
echo.

REM Matar processo do servidor
taskkill /f /im node.exe /fi "WINDOWTITLE eq Sistema de Licencas - Server*" 2>nul

REM Aguardar um momento
timeout /t 2 /nobreak >nul

REM Verificar se ainda existem processos
set "STILL_RUNNING=0"
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo list ^| findstr /i "PID:"') do (
    set "STILL_RUNNING=1"
)

if "%STILL_RUNNING%"=="1" (
    echo [AVISO] Alguns processos Node.js ainda estao em execucao.
    echo.
    choice /C SN /M "Deseja encerrar TODOS os processos Node.js? (S/N)"
    if errorlevel 1 if not errorlevel 2 (
        echo [INFO] Encerrando todos os processos Node.js...
        taskkill /f /im node.exe 2>nul
    )
)

echo.
echo ====================================================
echo      SISTEMA ENCERRADO
echo ====================================================
echo   Servidor foi parado
echo.
echo   Para reiniciar: execute start-sistema.bat
echo ====================================================
echo.

:END
pause
