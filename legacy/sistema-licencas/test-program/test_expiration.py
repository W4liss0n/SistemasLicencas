#!/usr/bin/env python3
"""
Test Expiration - Script para testar expiração de licença e tempo offline
"""

import sys
import os
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Adiciona o diretório do cliente ao path
sys.path.insert(0, str(Path(__file__).parent.parent / 'client' / 'python'))

from license_client import LicenseValidator, LicenseCache

def parse_datetime(dt_str):
    """Parse datetime string, handling both aware and naive datetimes"""
    if not dt_str:
        return None
    try:
        # Try parsing with timezone
        dt = datetime.fromisoformat(dt_str)
        # If naive, make it aware (local timezone)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except:
        return None

def now_aware():
    """Get current datetime with timezone"""
    return datetime.now(timezone.utc)


def show_menu():
    print("\n" + "=" * 60)
    print("    TESTE DE EXPIRAÇÃO DE LICENÇA")
    print("=" * 60)
    print("\n1. Ver status atual da licença")
    print("2. Simular expiração da assinatura (modificar data_fim no banco)")
    print("3. Simular expiração do cache offline (modificar cache local)")
    print("4. Validar online (testa se detecta expiração)")
    print("5. Validar offline (usa cache)")
    print("6. Limpar cache (força revalidação)")
    print("7. Mostrar conteúdo do cache")
    print("8. Avançar tempo do cache em X horas")
    print("9. Restaurar cache original")
    print("0. Sair")
    print()


class ExpirationTester:
    def __init__(self):
        # Mesma configuração do programa de teste
        self.validator = LicenseValidator(
            program_id="2b4763bf-fd52-4e05-8585-7d023236f789",
            program_name="TestCalculator",
            version="1.0.0",
            api_url="http://localhost:3000"
        )
        self.cache = LicenseCache("TestCalculator")
        self.original_cache = None

    def show_status(self):
        """Mostra status atual da licença"""
        print("\n📊 STATUS ATUAL:")
        print("-" * 60)

        # Verifica cache
        cached = self.cache.load()
        if cached:
            print("✅ Cache encontrado")
            print(f"   Chave: {cached.get('license_key', 'N/A')[:8]}...")

            if cached.get('validated_at'):
                validated = parse_datetime(cached.get('validated_at'))
                if validated:
                    print(f"   Validado em: {validated.strftime('%d/%m/%Y %H:%M')}")

            if cached.get('expires_at'):
                expires = parse_datetime(cached.get('expires_at'))
                if expires:
                    remaining = (expires - now_aware()).total_seconds() / 3600
                    print(f"   Cache expira em: {expires.strftime('%d/%m/%Y %H:%M')} ({remaining:.1f}h)")

            # Calcula expiração offline
            max_offline = cached.get('max_offline_hours', 168)
            if cached.get('validated_at'):
                validated = parse_datetime(cached.get('validated_at'))
                if validated:
                    offline_expires = validated + timedelta(hours=max_offline)
                    offline_remaining = (offline_expires - now_aware()).total_seconds() / 3600

                    if offline_remaining > 0:
                        print(f"   Offline até: {offline_expires.strftime('%d/%m/%Y %H:%M')} ({offline_remaining:.1f}h)")
                    else:
                        print(f"   ⚠️  Período offline EXPIRADO há {abs(offline_remaining):.1f}h)")
        else:
            print("❌ Nenhum cache encontrado")

        # Tenta validar
        print("\n🔍 Tentando validar...")
        if self.validator.validate():
            print("✅ Licença VÁLIDA")
        else:
            print("❌ Licença INVÁLIDA ou EXPIRADA")

    def simulate_subscription_expiration(self):
        """Simula expiração da assinatura no banco"""
        print("\n⚠️  SIMULAÇÃO DE EXPIRAÇÃO DA ASSINATURA")
        print("-" * 60)
        print("Para simular, execute este comando SQL no banco:")
        print()
        print("UPDATE assinaturas")
        print("SET data_fim = CURRENT_DATE - INTERVAL '1 day'")
        print("WHERE id = (SELECT assinatura_id FROM licencas")
        print("            WHERE license_key = 'SUA-CHAVE-AQUI');")
        print()
        print("Ou para expirar em 5 minutos:")
        print("UPDATE assinaturas")
        print("SET data_fim = NOW() + INTERVAL '5 minutes'")
        print("WHERE id = ...;")
        print()
        print("📝 Depois teste a validação online para ver o erro de expiração")

    def simulate_offline_expiration(self):
        """Modifica o cache para simular expiração offline"""
        print("\n⏰ SIMULAÇÃO DE EXPIRAÇÃO OFFLINE")
        print("-" * 60)

        cached = self.cache.load()
        if not cached:
            print("❌ Nenhum cache para modificar")
            return

        # Salva backup
        if not self.original_cache:
            self.original_cache = cached.copy()
            print("💾 Backup do cache original salvo")

        # Modifica validated_at para parecer antigo
        old_date = now_aware() - timedelta(days=8)  # 8 dias atrás
        cached['validated_at'] = old_date.isoformat()

        # Salva cache modificado
        self.cache.save(cached)

        print(f"✅ Cache modificado:")
        print(f"   validated_at alterado para: {old_date.strftime('%d/%m/%Y %H:%M')}")
        print(f"   Com max_offline_hours = {cached.get('max_offline_hours', 168)}")
        print(f"   Isso significa que expirou há ~1 dia")
        print()
        print("🔍 Agora teste a validação offline para ver se detecta expiração")

    def validate_online(self):
        """Força validação online"""
        print("\n🌐 VALIDAÇÃO ONLINE FORÇADA")
        print("-" * 60)

        if self.validator.validate(force_online=True):
            print("✅ Validação online: SUCESSO")
            info = self.validator.get_license_info()
            if info and info.get('days_remaining') is not None:
                print(f"   Dias restantes: {info['days_remaining']}")
        else:
            print("❌ Validação online: FALHOU")
            print("   Possíveis razões:")
            print("   - Assinatura expirada")
            print("   - Licença bloqueada")
            print("   - Programa não está no plano")
            print("   - Servidor offline")

    def validate_offline(self):
        """Tenta validar usando apenas cache"""
        print("\n💾 VALIDAÇÃO OFFLINE (cache)")
        print("-" * 60)

        # Desconecta para simular offline
        original_url = self.validator.api_url
        self.validator.api_url = "http://invalid-url-to-force-offline"

        if self.validator.validate():
            print("✅ Validação offline: SUCESSO")
            print("   Usando cache local válido")
        else:
            print("❌ Validação offline: FALHOU")
            print("   Cache expirado ou inválido")
            print("   Precisa conexão com servidor")

        # Restaura URL
        self.validator.api_url = original_url

    def clear_cache(self):
        """Limpa o cache"""
        print("\n🗑️  LIMPANDO CACHE")
        print("-" * 60)
        self.cache.clear()
        print("✅ Cache limpo. Próxima validação precisará do servidor.")

    def show_cache_content(self):
        """Mostra conteúdo detalhado do cache"""
        print("\n📋 CONTEÚDO DO CACHE")
        print("-" * 60)

        cached = self.cache.load()
        if cached:
            # Formata JSON bonito
            print(json.dumps(cached, indent=2, ensure_ascii=False))

            # Análise adicional
            print("\n📊 ANÁLISE:")

            if cached.get('validated_at'):
                validated = parse_datetime(cached.get('validated_at'))
                if validated:
                    age = (now_aware() - validated).total_seconds() / 3600
                    print(f"   Idade do cache: {age:.1f} horas")

            max_offline = cached.get('max_offline_hours', 168)
            print(f"   Máximo offline: {max_offline} horas ({max_offline/24:.1f} dias)")

            if cached.get('validated_at'):
                validated = parse_datetime(cached.get('validated_at'))
                if validated:
                    offline_expires = validated + timedelta(hours=max_offline)
                    if now_aware() > offline_expires:
                        print("   ⚠️  STATUS: EXPIRADO OFFLINE")
                    else:
                        print("   ✅ STATUS: VÁLIDO OFFLINE")
        else:
            print("❌ Nenhum cache encontrado")

    def advance_cache_time(self):
        """Avança o tempo do cache em X horas"""
        print("\n⏭️  AVANÇAR TEMPO DO CACHE")
        print("-" * 60)

        cached = self.cache.load()
        if not cached:
            print("❌ Nenhum cache para modificar")
            return

        # Salva backup
        if not self.original_cache:
            self.original_cache = cached.copy()
            print("💾 Backup do cache original salvo")

        try:
            hours = int(input("Quantas horas retroceder o validated_at? (ex: 170 para expirar): "))

            if cached.get('validated_at'):
                current_validated = parse_datetime(cached.get('validated_at'))
                if current_validated:
                    new_validated = current_validated - timedelta(hours=hours)
                    cached['validated_at'] = new_validated.isoformat()

                    self.cache.save(cached)

                    print(f"✅ Tempo modificado:")
                    print(f"   Era: {current_validated.strftime('%d/%m/%Y %H:%M')}")
                    print(f"   Agora: {new_validated.strftime('%d/%m/%Y %H:%M')}")

                    # Verifica se vai expirar
                    max_offline = cached.get('max_offline_hours', 168)
                    offline_expires = new_validated + timedelta(hours=max_offline)

                    if now_aware() > offline_expires:
                        print(f"   ⚠️  Cache agora está EXPIRADO!")
                    else:
                        remaining = (offline_expires - now_aware()).total_seconds() / 3600
                        print(f"   ✅ Ainda válido por {remaining:.1f} horas")
        except ValueError:
            print("❌ Valor inválido")

    def restore_cache(self):
        """Restaura cache original"""
        print("\n♻️  RESTAURAR CACHE ORIGINAL")
        print("-" * 60)

        if self.original_cache:
            self.cache.save(self.original_cache)
            print("✅ Cache original restaurado")
            self.original_cache = None
        else:
            print("❌ Nenhum backup para restaurar")


def main():
    tester = ExpirationTester()

    while True:
        show_menu()
        choice = input("Escolha uma opção: ").strip()

        if choice == '1':
            tester.show_status()
        elif choice == '2':
            tester.simulate_subscription_expiration()
        elif choice == '3':
            tester.simulate_offline_expiration()
        elif choice == '4':
            tester.validate_online()
        elif choice == '5':
            tester.validate_offline()
        elif choice == '6':
            tester.clear_cache()
        elif choice == '7':
            tester.show_cache_content()
        elif choice == '8':
            tester.advance_cache_time()
        elif choice == '9':
            tester.restore_cache()
        elif choice == '0':
            print("\n👋 Encerrando teste...")
            break
        else:
            print("❌ Opção inválida")

        input("\nPressione ENTER para continuar...")


if __name__ == "__main__":
    print("\n🧪 TESTE DE EXPIRAÇÃO DE LICENÇA")
    print("Este script permite testar cenários de expiração\n")

    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Teste interrompido")
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        import traceback
        traceback.print_exc()