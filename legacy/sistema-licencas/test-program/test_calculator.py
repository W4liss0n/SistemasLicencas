#!/usr/bin/env python3
"""
Test Calculator - Programa de teste para o Sistema de Licenças
Um programa fictício de calculadora que requer licença para funcionar
"""

import sys
import os
import time
from pathlib import Path

# Adiciona o diretório do cliente ao path para importar
sys.path.insert(0, str(Path(__file__).parent.parent / 'client' / 'python'))

from license_client import LicenseValidator


class LicensedCalculator:
    """Calculadora que requer licença válida para funcionar"""

    def __init__(self):
        print("=" * 60)
        print("    CALCULADORA PROFISSIONAL v1.0")
        print("    Software Licenciado - Teste do Sistema")
        print("=" * 60)
        print()

        # CONFIGURAÇÃO - SUBSTITUA COM SEUS DADOS
        self.validator = LicenseValidator(
            program_id="2b4763bf-fd52-4e05-8585-7d023236f789",  # <-- SUBSTITUIR COM UUID DO PROGRAMA
            program_name="TestCalculator",
            version="1.0.0",
            api_url="http://localhost:3000"  # <-- Ajustar se necessário
        )

        self.licensed = False
        self.check_and_activate_license()

    def check_and_activate_license(self):
        """Verifica e ativa a licença"""
        print("🔍 Verificando licença...")

        # Tenta validar licença existente
        if self.validator.validate():
            self.show_license_status()
            self.licensed = True
            return

        # Verifica se tem licença salva mas em outro dispositivo
        stored_license = self.validator._load_stored_license()
        if stored_license:
            print("\n⚠️  Licença encontrada, mas registrada em outro dispositivo.")
            print("=" * 60)
            self.handle_device_transfer()
            return

        # Não tem licença - precisa ativar
        print("\n❌ Nenhuma licença encontrada.")
        print("=" * 60)
        self.handle_activation()

    def handle_activation(self):
        """Gerencia ativação de nova licença"""
        print("\n📝 ATIVAÇÃO DE LICENÇA")
        print("-" * 60)
        print("Entre em contato com o administrador para obter uma chave.")
        print("Formato: XXXX-XXXX-XXXX-XXXX")
        print()

        max_attempts = 3
        for attempt in range(max_attempts):
            license_key = input("Digite a chave de licença (ou 'sair'): ").strip()

            if license_key.lower() == 'sair':
                print("\n👋 Ativação cancelada.")
                return

            if not license_key:
                continue

            print(f"\n🔄 Tentando ativar: {license_key[:8]}...")
            success, message = self.validator.activate(license_key)

            if success:
                print(f"✅ {message}")
                self.show_license_status()
                self.licensed = True
                return
            else:
                print(f"❌ Falha na ativação: {message}")

                if "already activated" in message.lower():
                    print("💡 Dica: Esta licença já está ativa em outro dispositivo.")
                    print("    Use a opção de transferência.")

                if attempt < max_attempts - 1:
                    print(f"⚠️  Tentativas restantes: {max_attempts - attempt - 1}")
                    print()

        print("\n❌ Número máximo de tentativas excedido.")

    def handle_device_transfer(self):
        """Gerencia transferência de dispositivo"""
        print("\n🔄 TRANSFERÊNCIA DE DISPOSITIVO")
        print("-" * 60)
        print("A licença está ativa em outro computador.")
        print("Deseja transferir para este computador?")
        print()
        print("⚠️  ATENÇÃO: Limite de 3 transferências por mês!")
        print()

        response = input("Transferir licença? (s/n): ").strip().lower()

        if response == 's':
            print("\n🔄 Transferindo licença...")
            success, message = self.validator.transfer()

            if success:
                print(f"✅ {message}")
                self.show_license_status()
                self.licensed = True
            else:
                print(f"❌ Falha na transferência: {message}")

                if "Monthly transfer limit" in message:
                    print("\n⚠️  LIMITE MENSAL ATINGIDO!")
                    print("Entre em contato com o suporte para resetar.")
                else:
                    print("\n💡 Tente ativar com uma nova chave.")
                    self.handle_activation()
        else:
            print("\n❌ Transferência cancelada.")
            print("💡 Você pode ativar com uma nova chave.")
            self.handle_activation()

    def show_license_status(self):
        """Mostra status da licença"""
        info = self.validator.get_license_info()
        if info:
            print("\n✅ LICENÇA ATIVA")
            print("-" * 60)
            print(f"📋 Chave: {info['license_key'][:4]}...{info['license_key'][-4:]}")

            if info.get('activated_at'):
                print(f"📅 Ativada em: {info['activated_at'][:10]}")

            if info.get('days_remaining') is not None:
                days = info['days_remaining']
                if days <= 7:
                    print(f"⚠️  Expira em: {days} dias")
                else:
                    print(f"📅 Dias restantes: {days}")

            print("-" * 60)

    def run(self):
        """Executa a calculadora"""
        if not self.licensed:
            print("\n❌ Programa não pode ser executado sem licença válida.")
            return

        print("\n🚀 CALCULADORA INICIADA COM SUCESSO!")
        print("=" * 60)
        print()
        print("OPERAÇÕES DISPONÍVEIS:")
        print("  + : Adição")
        print("  - : Subtração")
        print("  * : Multiplicação")
        print("  / : Divisão")
        print("  q : Sair")
        print()

        while True:
            try:
                # Validação periódica (a cada 10 operações)
                if hasattr(self, 'operation_count'):
                    self.operation_count += 1
                    if self.operation_count % 10 == 0:
                        print("🔄 Validando licença...")
                        if not self.validator.validate():
                            print("\n❌ Licença expirou ou foi revogada!")
                            break
                else:
                    self.operation_count = 0

                # Interface da calculadora
                expression = input("\nDigite a operação (ex: 2+2) ou 'q' para sair: ").strip()

                if expression.lower() == 'q':
                    print("\n👋 Encerrando calculadora...")
                    # Envia heartbeat final
                    self.validator.heartbeat()
                    break

                # Calcula
                try:
                    result = eval(expression)
                    print(f"📊 Resultado: {result}")
                except:
                    print("❌ Operação inválida!")

            except KeyboardInterrupt:
                print("\n\n👋 Programa interrompido.")
                break

        print("\n✅ Obrigado por usar a Calculadora Licenciada!")

    def menu(self):
        """Menu principal com opções de gerenciamento"""
        while True:
            print("\n" + "=" * 60)
            print("    MENU PRINCIPAL")
            print("=" * 60)

            if self.licensed:
                print("✅ Status: LICENCIADO")
            else:
                print("❌ Status: NÃO LICENCIADO")

            print("\n1. Usar Calculadora")
            print("2. Ver Status da Licença")
            print("3. Validar Licença Online")
            print("4. Desativar Este Dispositivo")
            print("5. Transferir de Outro Dispositivo")
            print("6. Ativar Nova Licença")
            print("0. Sair")
            print()

            choice = input("Escolha uma opção: ").strip()

            if choice == '1':
                if self.licensed:
                    self.run()
                else:
                    print("\n❌ Ative a licença primeiro!")
                    self.handle_activation()

            elif choice == '2':
                if self.licensed:
                    self.show_license_status()
                else:
                    print("\n❌ Nenhuma licença ativa.")

            elif choice == '3':
                print("\n🔄 Validando online...")
                if self.validator.validate(force_online=True):
                    print("✅ Licença válida!")
                    self.licensed = True
                    self.show_license_status()
                else:
                    print("❌ Licença inválida ou expirada.")
                    self.licensed = False

            elif choice == '4':
                if self.licensed:
                    confirm = input("\n⚠️  Desativar este dispositivo? (s/n): ").lower()
                    if confirm == 's':
                        success, message = self.validator.deactivate()
                        if success:
                            print(f"✅ {message}")
                            self.licensed = False
                        else:
                            print(f"❌ {message}")
                else:
                    print("\n❌ Nenhuma licença para desativar.")

            elif choice == '5':
                self.handle_device_transfer()

            elif choice == '6':
                self.handle_activation()

            elif choice == '0':
                print("\n👋 Encerrando programa...")
                if self.licensed:
                    self.validator.heartbeat()
                break

            else:
                print("\n❌ Opção inválida!")


def main():
    """Ponto de entrada principal"""
    print("\n" * 2)

    try:
        # Cria instância da calculadora
        calc = LicensedCalculator()

        # Se licença foi validada, mostra menu
        if calc.licensed:
            calc.menu()
        else:
            # Oferece tentar novamente
            retry = input("\nDeseja tentar ativar novamente? (s/n): ").lower()
            if retry == 's':
                calc.handle_activation()
                if calc.licensed:
                    calc.menu()
            else:
                print("\n❌ Programa encerrado - Licença necessária.")

    except KeyboardInterrupt:
        print("\n\n👋 Programa interrompido pelo usuário.")
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()