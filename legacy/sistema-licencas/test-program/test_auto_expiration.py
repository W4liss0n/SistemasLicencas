#!/usr/bin/env python3
"""
Teste Automatizado de Expiração - Testa expiração, validação offline e cache
"""

import sys
import os
import json
import time
import psycopg2
import requests
from pathlib import Path
from datetime import datetime, timedelta, timezone
import shutil

# Adiciona diretório do cliente ao path
sys.path.insert(0, str(Path(__file__).parent.parent / 'client' / 'python'))

from license_client import LicenseValidator

class TestadorExpiracao:
    def __init__(self):
        # Configuração do banco de dados
        self.db_config = {
            'host': 'localhost',
            'database': 'sistema_licencas',
            'user': 'licencas_user',
            'password': 'licencas123',
            'port': 5432
        }

        # Configuração da API
        self.api_base = 'http://localhost:3000/api/v1'

        # Validador de licença
        self.validator = LicenseValidator(
            program_id="2b4763bf-fd52-4e05-8585-7d023236f789",
            program_name="TestCalculator",
            version="1.0.0",
            api_url="http://localhost:3000"
        )

        # Usa o cache do validator, não cria um separado
        self.cache = self.validator.cache

        # Backup do cache original
        self.cache_backup_path = None

    def get_db_connection(self):
        """Obtém conexão com PostgreSQL"""
        return psycopg2.connect(**self.db_config)

    def backup_cache(self):
        """Faz backup do cache atual"""
        cache_file = self.cache.cache_file
        if cache_file.exists():
            self.cache_backup_path = cache_file.parent / "license.dat.backup"
            shutil.copy2(cache_file, self.cache_backup_path)
            print("   💾 Backup do cache realizado")
            print(f"      Arquivo: {cache_file.name}")
            print(f"      Backup: {self.cache_backup_path.name}")

    def restore_cache(self):
        """Restaura cache do backup"""
        if self.cache_backup_path and self.cache_backup_path.exists():
            shutil.copy2(self.cache_backup_path, self.cache.cache_file)
            print("   ♻️  Cache restaurado do backup")
            print(f"      De: {self.cache_backup_path.name}")
            print(f"      Para: {self.cache.cache_file.name}")

    def get_license_and_subscription(self, license_key):
        """Obtém IDs da licença e assinatura do banco de dados"""
        print(f"   🔍 Consultando banco de dados...")
        print(f"      Licença: {license_key[:8]}...")

        conn = self.get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT l.id, l.assinatura_id, l.status, l.max_offline_hours,
                       a.data_fim, a.status as sub_status
                FROM licencas l
                JOIN assinaturas a ON l.assinatura_id = a.id
                WHERE l.license_key = %s
            """, (license_key,))

            result = cursor.fetchone()
            if result:
                info = {
                    'license_id': result[0],
                    'subscription_id': result[1],
                    'license_status': result[2],
                    'max_offline_hours': result[3],
                    'subscription_end': result[4],
                    'subscription_status': result[5]
                }
                print(f"      ID da licença: {info['license_id']}")
                print(f"      ID da assinatura: {info['subscription_id']}")
                print(f"      Status da licença: {info['license_status']}")
                print(f"      Máximo offline: {info['max_offline_hours']} horas")
                print(f"      Expira em: {info['subscription_end']}")
                return info

            print("      ❌ Licença não encontrada no banco")
            return None
        finally:
            cursor.close()
            conn.close()

    def expire_subscription(self, subscription_id, minutes_ago=5):
        """Define data de expiração da assinatura para o passado"""
        print(f"\n   ⏰ Expirando assinatura no banco de dados...")
        print(f"      ID da assinatura: {subscription_id}")
        print(f"      Expirando para: {minutes_ago} minutos atrás")

        conn = self.get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                UPDATE assinaturas
                SET data_fim = NOW() - INTERVAL '%s minutes',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING data_fim
            """, (minutes_ago, subscription_id))

            new_date = cursor.fetchone()[0]
            conn.commit()
            print(f"      ✅ Assinatura expirada com sucesso")
            print(f"      Nova data de expiração: {new_date}")
            return True
        except Exception as e:
            print(f"      ❌ Erro ao expirar assinatura: {e}")
            conn.rollback()
            return False
        finally:
            cursor.close()
            conn.close()

    def restore_subscription(self, subscription_id, days_remaining=30):
        """Restaura assinatura para estado ativo"""
        print(f"\n   🔄 Restaurando assinatura no banco...")
        print(f"      ID da assinatura: {subscription_id}")
        print(f"      Dias restantes: {days_remaining}")

        conn = self.get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                UPDATE assinaturas
                SET data_fim = CURRENT_DATE + INTERVAL '%s days',
                    status = 'ativa',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING data_fim
            """, (days_remaining, subscription_id))

            new_date = cursor.fetchone()[0]
            conn.commit()
            print(f"      ✅ Assinatura restaurada")
            print(f"      Nova expiração: {new_date}")
            return True
        except Exception as e:
            print(f"      ❌ Erro ao restaurar assinatura: {e}")
            conn.rollback()
            return False
        finally:
            cursor.close()
            conn.close()

    def modify_cache_time(self, hours_ago):
        """Modifica o tempo validated_at do cache"""
        print(f"\n   🕒 Modificando tempo do cache local...")
        print(f"      Alterando para: {hours_ago} horas atrás")

        # Carrega cache com parâmetros corretos
        stored_license = self.validator._load_stored_license()
        fingerprint_hash = self.validator.fingerprint.get('hash') if isinstance(self.validator.fingerprint, dict) else None
        cached = self.cache.load(stored_license, fingerprint_hash)
        if not cached:
            print("      ❌ Nenhum cache para modificar")
            return False

        try:
            # Calcula nova data
            old_date = datetime.now(timezone.utc) - timedelta(hours=hours_ago)

            # Mostra tempo original
            if 'validated_at' in cached:
                original = cached['validated_at']
                print(f"      Tempo original: {original}")

            # Modifica
            cached['validated_at'] = old_date.isoformat()

            # Salva cache modificado com os parâmetros corretos
            stored_license = self.validator._load_stored_license()
            fingerprint_hash = self.validator.fingerprint.get('hash') if isinstance(self.validator.fingerprint, dict) else None
            self.cache.save(cached, stored_license, fingerprint_hash)

            print(f"      ✅ Cache modificado com sucesso")
            print(f"      Novo tempo: {old_date.isoformat()}")

            # Calcula expiração offline
            max_offline = cached.get('max_offline_hours', 168)
            expires_at = old_date + timedelta(hours=max_offline)
            time_remaining = (expires_at - datetime.now(timezone.utc)).total_seconds() / 3600

            if time_remaining > 0:
                print(f"      ⏱️  Cache ainda válido por: {time_remaining:.1f} horas")
            else:
                print(f"      ⚠️  Cache EXPIRADO há: {abs(time_remaining):.1f} horas")

            return True
        except Exception as e:
            print(f"      ❌ Erro ao modificar cache: {e}")
            return False

    def clear_redis_cache(self, license_key):
        """Limpa cache Redis para a licença"""
        print(f"\n   🗑️  Limpando cache Redis...")
        print(f"      Licença: {license_key[:8]}...")

        try:
            import redis
            r = redis.Redis(host='localhost', port=6379, decode_responses=True)
            cache_key = f"license:{license_key}:validation"
            print(f"      Chave Redis: {cache_key}")

            deleted = r.delete(cache_key)
            if deleted:
                print(f"      ✅ Cache Redis removido")
            else:
                print(f"      ℹ️  Nenhum cache Redis encontrado")
            return True
        except Exception as e:
            print(f"      ⚠️  Não foi possível limpar Redis: {e}")
            return False

    def test_subscription_expiration(self):
        """Testa detecção de expiração de assinatura"""
        print("\n" + "="*70)
        print("TESTE 1: EXPIRAÇÃO DE ASSINATURA")
        print("="*70)
        print("Este teste verifica se o sistema detecta corretamente quando")
        print("uma assinatura expira e bloqueia o acesso à licença.")
        print("-"*70)

        # Obtém informações da licença atual
        print("\n📋 ETAPA 1: Preparando teste...")
        info = self.validator.get_license_info()
        if not info:
            print("   ⚠️  Sem cache local, validando online primeiro...")
            self.validator.validate(force_online=True)
            info = self.validator.get_license_info()

        if not info:
            print("   ⚠️  Usando licença de teste padrão")
            license_key = "LIC-W3SK-ZLX1-3XKS-WPRA"
        else:
            license_key = info['license_key']

        print(f"   Licença selecionada: {license_key}")

        # Obtém informações do banco
        print("\n📊 ETAPA 2: Obtendo informações do banco de dados...")
        db_info = self.get_license_and_subscription(license_key)
        if not db_info:
            print("   ❌ Não foi possível obter informações do banco")
            return False

        # Testa validação antes da expiração
        print("\n✅ ETAPA 3: Testando validação ANTES da expiração...")
        print("   Esperado: Validação deve retornar SUCESSO")
        if self.validator.validate(force_online=True):
            print("   ✅ CORRETO: Validação retornou SUCESSO")
        else:
            print("   ❌ ERRO: Validação retornou FALHA (inesperado)")

        # Expira a assinatura
        print("\n⏰ ETAPA 4: Expirando a assinatura...")
        if not self.expire_subscription(db_info['subscription_id'], minutes_ago=5):
            return False

        # Limpa cache Redis
        self.clear_redis_cache(license_key)

        # Testa validação após expiração
        print("\n🔍 ETAPA 5: Testando validação APÓS expiração...")
        print("   Esperado: Validação deve retornar FALHA")
        time.sleep(1)  # Aguarda um pouco

        if self.validator.validate(force_online=True):
            print("   ❌ ERRO: Validação retornou SUCESSO (deveria falhar!)")
            print("      A expiração não está sendo detectada corretamente")
            success = False
        else:
            print("   ✅ CORRETO: Validação retornou FALHA")
            print("      Sistema detectou corretamente a expiração")
            success = True

        # Restaura assinatura
        print("\n♻️ ETAPA 6: Restaurando assinatura...")
        self.restore_subscription(db_info['subscription_id'])
        self.clear_redis_cache(license_key)

        print("\n" + "-"*70)
        if success:
            print("✅ TESTE PASSOU: Expiração detectada corretamente")
        else:
            print("❌ TESTE FALHOU: Expiração não foi detectada")

        return success

    def test_offline_validation(self):
        """Testa validação offline com cache"""
        print("\n" + "="*70)
        print("TESTE 2: VALIDAÇÃO OFFLINE")
        print("="*70)
        print("Este teste verifica se o sistema consegue validar licenças")
        print("usando o cache local quando não há conexão com o servidor.")
        print("-"*70)

        # Limpa cache primeiro
        print("\n🧹 ETAPA 1: Limpando cache local...")
        self.cache.clear()
        print("   ✅ Cache local removido")
        print("   Agora não há cache para validação offline")

        # Valida online para criar cache
        print("\n🌐 ETAPA 2: Validando online para criar cache...")
        print("   Conectando ao servidor...")
        if not self.validator.validate(force_online=True):
            print("   ❌ Validação online falhou")
            return False
        print("   ✅ Validação online bem-sucedida")
        print("   Cache local foi criado com dados do servidor")

        # Verifica se cache existe
        print("\n🔍 ETAPA 3: Verificando cache criado...")
        # Precisa passar os parâmetros para load() com a nova implementação
        stored_license = self.validator._load_stored_license()
        fingerprint_hash = self.validator.fingerprint.get('hash') if isinstance(self.validator.fingerprint, dict) else None
        cached = self.cache.load(stored_license, fingerprint_hash)
        if not cached:
            print("   ❌ Nenhum cache foi criado")
            return False

        print("   ✅ Cache encontrado com sucesso")
        print(f"   Máximo de horas offline: {cached.get('max_offline_hours', 168)}")
        print(f"   Validado em: {cached.get('validated_at', 'N/A')}")

        # Simula modo offline
        print("\n📴 ETAPA 4: Simulando modo offline...")
        print("   Salvando URL original do servidor...")
        original_url = self.validator.api_url
        print(f"   URL original: {original_url}")

        print("   Alterando URL para simular falha de conexão...")
        self.validator.api_url = "http://servidor-offline-invalido"
        print(f"   Nova URL (inválida): {self.validator.api_url}")

        # Testa validação offline com cache válido
        print("\n🔐 ETAPA 5: Testando validação offline...")
        print("   Servidor está inacessível")
        print("   Sistema deve usar cache local")
        print("   Esperado: Validação deve retornar SUCESSO")

        if self.validator.validate():
            print("   ✅ CORRETO: Validação offline funcionou")
            print("      Cache local foi usado com sucesso")
            success = True
        else:
            print("   ❌ ERRO: Validação offline falhou")
            print("      Cache deveria permitir acesso offline")
            success = False

        # Restaura URL
        print("\n♻️ ETAPA 6: Restaurando configuração...")
        self.validator.api_url = original_url
        print(f"   URL restaurada: {self.validator.api_url}")

        print("\n" + "-"*70)
        if success:
            print("✅ TESTE PASSOU: Validação offline funciona corretamente")
        else:
            print("❌ TESTE FALHOU: Validação offline não está funcionando")

        return success

    def test_offline_expiration(self):
        """Testa limite de tempo offline"""
        print("\n" + "="*70)
        print("TESTE 3: LIMITE DE TEMPO OFFLINE")
        print("="*70)
        print("Este teste verifica se o sistema respeita o limite máximo")
        print("de tempo que uma licença pode funcionar offline.")
        print("-"*70)

        # Backup do cache atual
        print("\n💾 ETAPA 1: Fazendo backup do cache atual...")
        self.backup_cache()

        # Cria cache novo
        print("\n🔄 ETAPA 2: Criando cache novo...")
        self.cache.clear()
        print("   Cache limpo, validando online...")

        if not self.validator.validate(force_online=True):
            print("   ❌ Não foi possível criar cache")
            return False
        print("   ✅ Cache criado com sucesso")

        # Obtém limite offline
        print("\n⏱️ ETAPA 3: Verificando limite de tempo offline...")
        # Precisa passar os parâmetros para load()
        stored_license = self.validator._load_stored_license()
        fingerprint_hash = self.validator.fingerprint.get('hash') if isinstance(self.validator.fingerprint, dict) else None
        cached = self.cache.load(stored_license, fingerprint_hash)
        if not cached:
            print("   ❌ Cache não encontrado")
            return False
        max_offline = cached.get('max_offline_hours', 168)
        print(f"   Limite máximo offline: {max_offline} horas ({max_offline/24:.1f} dias)")

        # Teste 1: Cache quase expirando (ainda válido)
        print(f"\n🕐 ETAPA 4: Testando cache ANTES de expirar...")
        hours_ago = max_offline - 1
        print(f"   Modificando cache para {hours_ago} horas atrás")
        print(f"   Ainda resta 1 hora de validade offline")
        self.modify_cache_time(hours_ago)

        # Simula offline
        original_url = self.validator.api_url
        self.validator.api_url = "http://servidor-offline-invalido"

        print("\n   Testando validação offline (deve funcionar)...")
        if self.validator.validate():
            print("   ✅ CORRETO: Cache ainda válido, validação passou")
            before_success = True
        else:
            print("   ❌ ERRO: Cache deveria estar válido ainda")
            before_success = False

        # Teste 2: Cache expirado
        print(f"\n⏰ ETAPA 5: Testando cache APÓS expirar...")
        hours_ago = max_offline + 1
        print(f"   Modificando cache para {hours_ago} horas atrás")
        print(f"   Cache expirado há 1 hora")
        self.modify_cache_time(hours_ago)

        print("\n   Testando validação offline (deve falhar)...")
        if self.validator.validate():
            print("   ❌ ERRO: Cache expirado mas validação passou!")
            print("      Limite de tempo offline não está funcionando")
            after_success = False
        else:
            print("   ✅ CORRETO: Cache expirado, validação falhou")
            print("      Limite de tempo offline está funcionando")
            after_success = True

        # Restaura
        print("\n♻️ ETAPA 6: Restaurando configurações...")
        self.validator.api_url = original_url
        self.restore_cache()

        print("\n" + "-"*70)
        success = before_success and after_success
        if success:
            print("✅ TESTE PASSOU: Limite de tempo offline funciona corretamente")
        else:
            print("❌ TESTE FALHOU: Problemas com limite de tempo offline")

        return success

    def test_cache_tampering(self):
        """Testa detecção de adulteração do cache"""
        print("\n" + "="*70)
        print("TESTE 4: DETECÇÃO DE ADULTERAÇÃO DO CACHE")
        print("="*70)
        print("Este teste verifica se o sistema detecta quando alguém")
        print("tenta modificar o cache local para burlar a validação.")
        print("-"*70)

        # Cria cache válido
        print("\n🔒 ETAPA 1: Criando cache válido...")
        self.cache.clear()
        if not self.validator.validate(force_online=True):
            print("   ❌ Não foi possível criar cache")
            return False
        print("   ✅ Cache criado e criptografado")

        # Backup
        print("\n💾 ETAPA 2: Fazendo backup do cache válido...")
        self.backup_cache()

        # Adultera o cache
        print("\n🔨 ETAPA 3: Adulterando o cache...")
        # Carrega cache com parâmetros corretos
        stored_license = self.validator._load_stored_license()
        fingerprint_hash = self.validator.fingerprint.get('hash') if isinstance(self.validator.fingerprint, dict) else None
        cached = self.cache.load(stored_license, fingerprint_hash)
        if cached:
            original_key = cached.get('license_key', '')
            print(f"   Chave original: {original_key[:8]}...")

            # Muda a chave de licença
            cached['license_key'] = 'LICENCA-FALSA-ADULTERADA'
            # Salva com os mesmos parâmetros
            self.cache.save(cached, stored_license, fingerprint_hash)
            print(f"   Chave adulterada: LICENCA-FALSA...")
            print("   ⚠️  Cache foi modificado indevidamente")

        # Testa validação com cache adulterado
        print("\n🔍 ETAPA 4: Testando validação com cache ADULTERADO...")
        print("   Simulando modo offline...")
        original_url = self.validator.api_url
        self.validator.api_url = "http://servidor-offline-invalido"

        print("   Esperado: Validação deve FALHAR (detectar adulteração)")

        if self.validator.validate():
            print("   ❌ PERIGO: Validação passou com cache adulterado!")
            print("      Sistema não detectou a modificação indevida")
            success = False
        else:
            print("   ✅ CORRETO: Validação falhou")
            print("      Sistema detectou a adulteração do cache")
            success = True

        # Restaura
        print("\n♻️ ETAPA 5: Restaurando configurações...")
        self.validator.api_url = original_url
        self.restore_cache()

        print("\n" + "-"*70)
        if success:
            print("✅ TESTE PASSOU: Adulteração de cache é detectada")
        else:
            print("❌ TESTE FALHOU: Sistema vulnerável a adulteração de cache")

        return success

    def test_simultaneous_device_change(self):
        """Testa detecção de mudança de dispositivo"""
        print("\n" + "="*70)
        print("TESTE 5: MUDANÇA DE DISPOSITIVO (FINGERPRINT)")
        print("="*70)
        print("Este teste verifica se o sistema detecta quando alguém")
        print("tenta usar o cache de um dispositivo em outro dispositivo.")
        print("-"*70)

        # Cria cache válido
        print("\n🖥️ ETAPA 1: Criando cache com fingerprint atual...")
        self.cache.clear()
        if not self.validator.validate(force_online=True):
            print("   ❌ Não foi possível criar cache")
            return False
        print("   ✅ Cache criado com fingerprint do dispositivo")

        # Backup
        print("\n💾 ETAPA 2: Fazendo backup...")
        self.backup_cache()

        # Modifica fingerprint no cache
        print("\n🔄 ETAPA 3: Simulando mudança de dispositivo...")
        # Carrega cache com parâmetros corretos
        stored_license = self.validator._load_stored_license()
        fingerprint_hash = self.validator.fingerprint.get('hash') if isinstance(self.validator.fingerprint, dict) else None
        cached = self.cache.load(stored_license, fingerprint_hash)
        if cached and 'fingerprint_hash' in cached:
            original_hash = cached['fingerprint_hash']
            print(f"   Fingerprint original: {original_hash[:16]}...")

            cached['fingerprint_hash'] = 'FINGERPRINT_DISPOSITIVO_DIFERENTE'
            # Salva com os mesmos parâmetros
            self.cache.save(cached, stored_license, fingerprint_hash)
            print(f"   Fingerprint alterado: FINGERPRINT_DISP...")
            print("   ⚠️  Cache agora simula outro dispositivo")

        # Testa validação offline com fingerprint diferente
        print("\n🔐 ETAPA 4: Testando validação com fingerprint DIFERENTE...")
        print("   Simulando modo offline...")
        original_url = self.validator.api_url
        self.validator.api_url = "http://servidor-offline-invalido"

        print("   Esperado: Validação deve FALHAR")
        print("   (fingerprint não corresponde ao dispositivo)")

        if self.validator.validate():
            print("   ❌ PERIGO: Validação passou com fingerprint diferente!")
            print("      Cache pode ser copiado entre dispositivos")
            success = False
        else:
            print("   ✅ CORRETO: Validação falhou")
            print("      Sistema detectou mudança de dispositivo")
            success = True

        # Restaura
        print("\n♻️ ETAPA 5: Restaurando configurações...")
        self.validator.api_url = original_url
        self.restore_cache()

        print("\n" + "-"*70)
        if success:
            print("✅ TESTE PASSOU: Mudança de dispositivo é detectada")
        else:
            print("❌ TESTE FALHOU: Cache pode ser usado em outros dispositivos")

        return success

    def run_all_tests(self):
        """Executa todos os testes"""
        print("\n" + "🧪 "*35)
        print("         SUITE COMPLETA DE TESTES AUTOMATIZADOS")
        print("           EXPIRAÇÃO, OFFLINE E SEGURANÇA")
        print("🧪 "*35)
        print("\nEsta suite testa os seguintes cenários críticos:")
        print("1. Expiração de assinatura")
        print("2. Validação offline com cache")
        print("3. Limite de tempo offline")
        print("4. Detecção de adulteração de cache")
        print("5. Detecção de mudança de dispositivo")
        print("\n" + "="*70)

        results = []
        time.sleep(2)  # Pausa dramática

        # Teste 1: Expiração de Assinatura
        try:
            print("\n🚀 Iniciando Teste 1...")
            time.sleep(1)
            result = self.test_subscription_expiration()
            results.append(("Expiração de Assinatura", result))
        except Exception as e:
            print(f"\n❌ Teste falhou com erro: {e}")
            results.append(("Expiração de Assinatura", False))

        time.sleep(2)

        # Teste 2: Validação Offline
        try:
            print("\n🚀 Iniciando Teste 2...")
            time.sleep(1)
            result = self.test_offline_validation()
            results.append(("Validação Offline", result))
        except Exception as e:
            print(f"\n❌ Teste falhou com erro: {e}")
            results.append(("Validação Offline", False))

        time.sleep(2)

        # Teste 3: Limite de Tempo Offline
        try:
            print("\n🚀 Iniciando Teste 3...")
            time.sleep(1)
            result = self.test_offline_expiration()
            results.append(("Limite de Tempo Offline", result))
        except Exception as e:
            print(f"\n❌ Teste falhou com erro: {e}")
            results.append(("Limite de Tempo Offline", False))

        time.sleep(2)

        # Teste 4: Adulteração de Cache
        try:
            print("\n🚀 Iniciando Teste 4...")
            time.sleep(1)
            result = self.test_cache_tampering()
            results.append(("Detecção de Adulteração", result))
        except Exception as e:
            print(f"\n❌ Teste falhou com erro: {e}")
            results.append(("Detecção de Adulteração", False))

        time.sleep(2)

        # Teste 5: Mudança de Dispositivo
        try:
            print("\n🚀 Iniciando Teste 5...")
            time.sleep(1)
            result = self.test_simultaneous_device_change()
            results.append(("Mudança de Dispositivo", result))
        except Exception as e:
            print(f"\n❌ Teste falhou com erro: {e}")
            results.append(("Mudança de Dispositivo", False))

        # Resumo Final
        print("\n" + "="*70)
        print("                    RESUMO DOS TESTES")
        print("="*70)

        all_passed = True
        for i, (test_name, passed) in enumerate(results, 1):
            status = "✅ PASSOU" if passed else "❌ FALHOU"
            print(f"{i}. {test_name:.<45} {status}")
            if not passed:
                all_passed = False

        print("="*70)

        if all_passed:
            print("\n🎉🎉🎉 TODOS OS TESTES PASSARAM! 🎉🎉🎉")
            print("O sistema está funcionando corretamente!")
        else:
            print("\n⚠️  ATENÇÃO: Alguns testes falharam!")
            print("Verifique a implementação dos recursos que falharam.")

        print("\n" + "🧪 "*35)

        return all_passed

def main():
    """Função principal"""
    tester = TestadorExpiracao()

    print("\n🤖 TESTE AUTOMATIZADO DE EXPIRAÇÃO E VALIDAÇÃO OFFLINE")
    print("Este script executa uma bateria completa de testes")
    print("para verificar o funcionamento correto do sistema.\n")

    try:
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n👋 Teste interrompido pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()