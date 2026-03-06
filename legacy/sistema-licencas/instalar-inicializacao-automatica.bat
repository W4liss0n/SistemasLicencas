@echo off
title Sistema de Licencas - Instalador de Inicializacao Automatica

REM ========================================
REM   Configurar Inicializacao Automatica
REM   com o Windows
REM ========================================

echo.
echo ====================================================
echo    Sistema de Licencas
echo    Instalador de Inicializacao Automatica
echo ====================================================
echo.

REM Obter caminho completo do script start-sistema.bat
set "SCRIPT_PATH=%~dp0start-sistema.bat"

REM Verificar se o arquivo existe
if not exist "%SCRIPT_PATH%" (
    echo [ERRO] Arquivo start-sistema.bat nao encontrado!
    echo Caminho esperado: %SCRIPT_PATH%
    pause
    exit /b 1
)

REM Definir pasta de inicializacao do Windows
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

REM Verificar se a pasta de inicializacao existe
if not exist "%STARTUP_FOLDER%" (
    echo [ERRO] Pasta de inicializacao do Windows nao encontrada!
    echo Caminho: %STARTUP_FOLDER%
    pause
    exit /b 1
)

REM Nome do atalho
set "SHORTCUT_NAME=Sistema de Licencas.lnk"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\%SHORTCUT_NAME%"

echo [INFO] Configurando inicializacao automatica...
echo.
echo Detalhes:
echo   Script: %SCRIPT_PATH%
echo   Atalho: %SHORTCUT_PATH%
echo.

REM Criar atalho usando PowerShell
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%SCRIPT_PATH%'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 1; $s.Description = 'Sistema de Licencas - Inicializacao Automatica'; $s.Save()"

if %errorlevel% neq 0 (
    echo [ERRO] Falha ao criar atalho!
    pause
    exit /b 1
)

echo ====================================================
echo    INSTALACAO CONCLUIDA COM SUCESSO!
echo ====================================================
echo   O Sistema de Licencas agora iniciara
echo   automaticamente quando o Windows iniciar.
echo ====================================================
echo   Atalho criado em:
echo   %STARTUP_FOLDER%
echo ====================================================
echo   Para remover a inicializacao automatica:
echo   1. Pressione Win + R
echo   2. Digite: shell:startup
echo   3. Delete o atalho "Sistema de Licencas"
echo ====================================================
echo.

REM Perguntar se deseja abrir a pasta de inicializacao
choice /C SN /M "Deseja abrir a pasta de inicializacao do Windows? (S/N)"
if errorlevel 1 if not errorlevel 2 (
    explorer "%STARTUP_FOLDER%"
)

echo.
echo Instalacao concluida! Voce pode fechar esta janela.
pause
