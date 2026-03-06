#!/bin/bash

echo "======================================"
echo "  Instalando dependências do teste"
echo "======================================"
echo

# Verifica se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não está instalado!"
    echo "   Instale com: sudo apt install python3 python3-pip"
    exit 1
fi

# Instala dependências
echo "📦 Instalando bibliotecas Python..."
pip3 install requests cryptography

echo
echo "✅ Dependências instaladas!"
echo
echo "======================================"
echo "  PRÓXIMOS PASSOS:"
echo "======================================"
echo
echo "1. Inicie o servidor:"
echo "   cd ../sistema-licencas && npm run dev"
echo
echo "2. Configure o programa (edite test_calculator.py):"
echo "   - Adicione o UUID do programa"
echo "   - Adicione a API Key"
echo
echo "3. Execute o teste:"
echo "   python3 test_calculator.py"
echo
echo "Consulte o README.md para instruções detalhadas!"