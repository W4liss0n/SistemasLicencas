#!/bin/bash

# Sistema de Gerenciamento de Licenças - Manager Script
# Controle unificado para Backend e Frontend

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Diretórios - Usar diretório onde o script está localizado
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"
FRONTEND_DIR="$SCRIPT_DIR/web"

# Arquivos PID
PID_DIR="/tmp/sistema-licencas"
BACKEND_PID="$PID_DIR/backend.pid"
FRONTEND_PID="$PID_DIR/frontend.pid"

# Logs
LOG_DIR="$PID_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# Criar diretórios necessários
mkdir -p "$PID_DIR"
mkdir -p "$LOG_DIR"

# Função para exibir o header
show_header() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════╗"
    echo "║     Sistema de Licenças - Manager         ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Função para verificar se um serviço está rodando
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# Função para obter status dos serviços
show_status() {
    echo -e "${BLUE}${BOLD}Status dos Serviços:${NC}"
    echo ""

    # Backend status
    if is_running "$BACKEND_PID"; then
        echo -e "  ${GREEN}●${NC} Backend API    ${GREEN}[RODANDO]${NC} - PID: $(cat $BACKEND_PID)"
        echo -e "    └─ URL: ${CYAN}http://localhost:3000${NC}"
    else
        echo -e "  ${RED}●${NC} Backend API    ${RED}[PARADO]${NC}"
    fi

    # Frontend status
    if is_running "$FRONTEND_PID"; then
        echo -e "  ${GREEN}●${NC} Frontend Web   ${GREEN}[RODANDO]${NC} - PID: $(cat $FRONTEND_PID)"
        echo -e "    └─ URL: ${CYAN}http://localhost:5173${NC}"
    else
        echo -e "  ${RED}●${NC} Frontend Web   ${RED}[PARADO]${NC}"
    fi
    echo ""
}

# Função para iniciar o backend
start_backend() {
    if is_running "$BACKEND_PID"; then
        echo -e "${YELLOW}⚠ Backend já está rodando!${NC}"
        return 1
    fi

    echo -e "${BLUE}▶ Iniciando Backend...${NC}"
    cd "$BACKEND_DIR"

    # Iniciar o backend em background
    npm run dev > "$BACKEND_LOG" 2>&1 < /dev/null &
    local pid=$!
    echo $pid > "$BACKEND_PID"

    # Aguardar inicialização
    sleep 5

    if is_running "$BACKEND_PID"; then
        echo -e "${GREEN}✓ Backend iniciado com sucesso!${NC}"
        return 0
    else
        echo -e "${RED}✗ Falha ao iniciar Backend${NC}"
        return 1
    fi
}

# Função para iniciar o frontend
start_frontend() {
    if is_running "$FRONTEND_PID"; then
        echo -e "${YELLOW}⚠ Frontend já está rodando!${NC}"
        return 1
    fi

    echo -e "${BLUE}▶ Iniciando Frontend...${NC}"
    cd "$FRONTEND_DIR"

    # Iniciar o frontend em background
    npm run dev > "$FRONTEND_LOG" 2>&1 < /dev/null &
    local pid=$!
    echo $pid > "$FRONTEND_PID"

    # Aguardar inicialização
    sleep 5

    if is_running "$FRONTEND_PID"; then
        echo -e "${GREEN}✓ Frontend iniciado com sucesso!${NC}"
        return 0
    else
        echo -e "${RED}✗ Falha ao iniciar Frontend${NC}"
        return 1
    fi
}

# Função para parar o backend
stop_backend() {
    if ! is_running "$BACKEND_PID"; then
        echo -e "${YELLOW}⚠ Backend não está rodando${NC}"
        return 1
    fi

    echo -e "${BLUE}■ Parando Backend...${NC}"
    local pid=$(cat "$BACKEND_PID")
    kill -TERM "$pid" 2>/dev/null

    # Aguardar processo terminar
    local count=0
    while [ $count -lt 10 ] && ps -p "$pid" > /dev/null 2>&1; do
        sleep 1
        count=$((count + 1))
    done

    # Forçar término se necessário
    if ps -p "$pid" > /dev/null 2>&1; then
        kill -KILL "$pid" 2>/dev/null
    fi

    rm -f "$BACKEND_PID"
    echo -e "${GREEN}✓ Backend parado${NC}"
}

# Função para parar o frontend
stop_frontend() {
    if ! is_running "$FRONTEND_PID"; then
        echo -e "${YELLOW}⚠ Frontend não está rodando${NC}"
        return 1
    fi

    echo -e "${BLUE}■ Parando Frontend...${NC}"
    local pid=$(cat "$FRONTEND_PID")
    kill -TERM "$pid" 2>/dev/null

    # Aguardar processo terminar
    local count=0
    while [ $count -lt 10 ] && ps -p "$pid" > /dev/null 2>&1; do
        sleep 1
        count=$((count + 1))
    done

    # Forçar término se necessário
    if ps -p "$pid" > /dev/null 2>&1; then
        kill -KILL "$pid" 2>/dev/null
    fi

    rm -f "$FRONTEND_PID"
    echo -e "${GREEN}✓ Frontend parado${NC}"
}

# Função para reiniciar o backend
restart_backend() {
    echo -e "${BLUE}↻ Reiniciando Backend...${NC}"
    stop_backend
    sleep 2
    start_backend
}

# Função para reiniciar o frontend
restart_frontend() {
    echo -e "${BLUE}↻ Reiniciando Frontend...${NC}"
    stop_frontend
    sleep 2
    start_frontend
}

# Função para iniciar todos os serviços
start_all() {
    echo -e "${MAGENTA}${BOLD}▶ Iniciando todos os serviços...${NC}"
    echo ""
    start_backend
    echo ""
    start_frontend
    echo ""
    echo -e "${GREEN}${BOLD}✓ Todos os serviços iniciados!${NC}"
}

# Função para parar todos os serviços
stop_all() {
    echo -e "${MAGENTA}${BOLD}■ Parando todos os serviços...${NC}"
    echo ""
    stop_frontend
    echo ""
    stop_backend
    echo ""
    echo -e "${GREEN}${BOLD}✓ Todos os serviços parados!${NC}"
}

# Função para reiniciar todos os serviços
restart_all() {
    echo -e "${MAGENTA}${BOLD}↻ Reiniciando todos os serviços...${NC}"
    echo ""
    stop_all
    sleep 2
    start_all
}

# Função para visualizar logs
view_logs() {
    echo -e "${BLUE}${BOLD}Logs disponíveis:${NC}"
    echo "  1) Backend"
    echo "  2) Frontend"
    echo "  3) Ambos (dividido)"
    echo "  0) Voltar"
    echo ""
    read -p "Escolha uma opção: " log_choice

    case $log_choice in
        1)
            echo -e "${CYAN}Logs do Backend (pressione Ctrl+C para sair):${NC}"
            tail -f "$BACKEND_LOG"
            ;;
        2)
            echo -e "${CYAN}Logs do Frontend (pressione Ctrl+C para sair):${NC}"
            tail -f "$FRONTEND_LOG"
            ;;
        3)
            echo -e "${CYAN}Logs combinados (pressione Ctrl+C para sair):${NC}"
            # Usar multitail se disponível, senão tail simples
            if command -v multitail &> /dev/null; then
                multitail -i "$BACKEND_LOG" -i "$FRONTEND_LOG"
            else
                tail -f "$BACKEND_LOG" "$FRONTEND_LOG"
            fi
            ;;
        0)
            return
            ;;
    esac
}

# Menu principal
show_menu() {
    echo -e "${YELLOW}${BOLD}Menu Principal:${NC}"
    echo ""
    echo "  ${BOLD}Controle Geral:${NC}"
    echo "    1) Iniciar TODOS os serviços"
    echo "    2) Parar TODOS os serviços"
    echo "    3) Reiniciar TODOS os serviços"
    echo ""
    echo "  ${BOLD}Backend API:${NC}"
    echo "    4) Iniciar Backend"
    echo "    5) Parar Backend"
    echo "    6) Reiniciar Backend"
    echo ""
    echo "  ${BOLD}Frontend Web:${NC}"
    echo "    7) Iniciar Frontend"
    echo "    8) Parar Frontend"
    echo "    9) Reiniciar Frontend"
    echo ""
    echo "  ${BOLD}Utilitários:${NC}"
    echo "    l) Ver logs"
    echo "    s) Atualizar status"
    echo "    c) Limpar tela"
    echo ""
    echo "    0) Sair"
    echo ""
}

# Função para processar comandos via argumentos
process_command() {
    case "$1" in
        start)
            case "$2" in
                backend)
                    start_backend
                    ;;
                frontend)
                    start_frontend
                    ;;
                all|"")
                    start_all
                    ;;
                *)
                    echo -e "${RED}Serviço inválido: $2${NC}"
                    echo "Use: $0 start [backend|frontend|all]"
                    exit 1
                    ;;
            esac
            ;;
        stop)
            case "$2" in
                backend)
                    stop_backend
                    ;;
                frontend)
                    stop_frontend
                    ;;
                all|"")
                    stop_all
                    ;;
                *)
                    echo -e "${RED}Serviço inválido: $2${NC}"
                    echo "Use: $0 stop [backend|frontend|all]"
                    exit 1
                    ;;
            esac
            ;;
        restart)
            case "$2" in
                backend)
                    restart_backend
                    ;;
                frontend)
                    restart_frontend
                    ;;
                all|"")
                    restart_all
                    ;;
                *)
                    echo -e "${RED}Serviço inválido: $2${NC}"
                    echo "Use: $0 restart [backend|frontend|all]"
                    exit 1
                    ;;
            esac
            ;;
        status)
            show_status
            ;;
        logs)
            case "$2" in
                backend)
                    tail -f "$BACKEND_LOG"
                    ;;
                frontend)
                    tail -f "$FRONTEND_LOG"
                    ;;
                *)
                    view_logs
                    ;;
            esac
            ;;
        *)
            echo -e "${RED}Comando inválido: $1${NC}"
            echo ""
            echo "Uso: $0 {start|stop|restart|status|logs} [backend|frontend|all]"
            echo ""
            echo "Exemplos:"
            echo "  $0 start          # Inicia todos os serviços"
            echo "  $0 start backend  # Inicia apenas o backend"
            echo "  $0 stop frontend  # Para apenas o frontend"
            echo "  $0 restart all    # Reinicia todos os serviços"
            echo "  $0 status         # Mostra status dos serviços"
            echo "  $0 logs backend   # Mostra logs do backend"
            echo ""
            echo "Ou execute sem argumentos para modo interativo."
            exit 1
            ;;
    esac
}

# Main
if [ $# -gt 0 ]; then
    # Modo comando direto
    process_command "$@"
else
    # Modo interativo
    while true; do
        show_header
        show_status
        show_menu

        read -p "Escolha uma opção: " choice
        echo ""

        case $choice in
            1)
                start_all
                ;;
            2)
                stop_all
                ;;
            3)
                restart_all
                ;;
            4)
                start_backend
                ;;
            5)
                stop_backend
                ;;
            6)
                restart_backend
                ;;
            7)
                start_frontend
                ;;
            8)
                stop_frontend
                ;;
            9)
                restart_frontend
                ;;
            l|L)
                view_logs
                ;;
            s|S)
                continue
                ;;
            c|C)
                clear
                continue
                ;;
            0)
                echo -e "${YELLOW}Deseja parar todos os serviços antes de sair? (s/n)${NC}"
                read -p "> " stop_choice
                if [[ "$stop_choice" =~ ^[Ss]$ ]]; then
                    stop_all
                fi
                echo -e "${GREEN}Até logo!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Opção inválida!${NC}"
                ;;
        esac

        if [ "$choice" != "c" ] && [ "$choice" != "C" ] && [ "$choice" != "s" ] && [ "$choice" != "S" ]; then
            echo ""
            echo -e "${CYAN}Pressione ENTER para continuar...${NC}"
            read
        fi
    done
fi