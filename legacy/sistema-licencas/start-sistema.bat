@echo off
title Sistema de Licencas - Iniciando...

REM ========================================
REM   Sistema de Licencas - Inicializador
REM   Configuracao automatica + Execucao
REM ========================================

cd /d "%~dp0"

echo.
echo ====================================================
echo      Sistema de Licencas - Inicializador
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

REM Verificar se arquivo .env existe
if not exist ".env" (
    echo [AVISO] Arquivo .env nao encontrado
    echo Criando .env a partir de .env.example
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [OK] Arquivo .env criado - Configure as variaveis de ambiente
        pause
    ) else (
        echo [ERRO] Arquivo .env.example nao encontrado
        pause
        exit /b 1
    )
)

REM Verificar conectividade com PostgreSQL e Redis
echo [INFO] Verificando conectividade com servidor (192.168.0.2)
ping -n 1 192.168.0.2 >nul 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] Servidor 192.168.0.2 parece inacessivel
    echo Verifique se PostgreSQL e Redis estao rodando
    echo.
) else (
    echo [OK] Servidor acessivel
    echo.
)

REM Verificar se e a primeira execucao
if not exist ".sistema-configurado" (
    echo.
    echo ===================================================
    echo   PRIMEIRA EXECUCAO DETECTADA
    echo   Configurando sistema...
    echo ===================================================
    echo.

    REM Instalar dependencias do backend
    echo [1/5] Instalando dependencias do backend
    call npm install
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar dependencias do backend
        pause
        exit /b 1
    )
    echo [OK] Dependencias do backend instaladas
    echo.

    REM Instalar dependencias do frontend
    echo [2/5] Instalando dependencias do frontend
    cd web
    call npm install
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar dependencias do frontend
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Dependencias do frontend instaladas
    echo.

    REM Executar migrations
    echo [3/5] Executando migrations do banco de dados
    call npm run migrate
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao executar migrations
        pause
        exit /b 1
    )
    echo [OK] Migrations executadas
    echo.

    REM Executar seed
    echo [4/5] Populando banco de dados com dados iniciais
    call npm run seed
    if %errorlevel% neq 0 (
        echo [AVISO] Falha ao executar seed (pode ser normal se ja existe dados)
    ) else (
        echo [OK] Banco de dados populado
    )
    echo.

    REM Criar arquivo de flag
    echo [5/5] Marcando sistema como configurado
    echo Sistema configurado em %date% %time% > .sistema-configurado
    echo [OK] Sistema configurado com sucesso
    echo.

    echo ===================================================
    echo   CONFIGURACAO CONCLUIDA
    echo ===================================================
    echo.
    pause
) else (
    echo [INFO] Sistema ja configurado - Iniciando servicos
    echo.
)

REM Verificar se frontend ja foi buildado
if not exist "web\dist\index.html" (
    echo.
    echo ===================================================
    echo   FRONTEND NAO BUILDADO - Buildando agora
    echo ===================================================
    echo.
    echo [INFO] Fazendo build do frontend (primeira vez)
    echo [INFO] Isso pode levar 1-2 minutos
    echo.
    cd web
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao buildar frontend
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Frontend buildado com sucesso
    echo.
)

REM Iniciar backend (que serve o frontend tambem)
echo ===================================================
echo   INICIANDO SISTEMA
echo ===================================================
echo.
echo [INFO] O backend servira tanto a API quanto o painel admin
echo [INFO] Iniciando em uma nova janela (porta 3000)
echo.
echo Pressione qualquer tecla para iniciar
pause >nul

REM Iniciar backend em uma nova janela
start "Sistema de Licencas - Server" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ====================================================
echo      SISTEMA INICIADO COM SUCESSO
echo ====================================================
echo   API Backend: http://localhost:3000/api/v1
echo   Painel Admin: http://localhost:3000/admin
echo   Health Check: http://localhost:3000/health
echo ====================================================
echo   Para parar: execute stop-sistema.bat
echo   Para rebuildar frontend: execute build-frontend.bat
echo ====================================================
echo.
echo Voce pode fechar esta janela agora
echo.
pause
