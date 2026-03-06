export type Cliente = {
  id: string;
  nome: string;
  email?: string;  // Agora é opcional
  telefone?: string;
  empresa?: string;
  usuario?: string;  // Novo: login do cliente
  senha?: string;    // Novo: senha (apenas para criação/edição)
  plano_id?: string; // Novo: plano padrão do cliente
  plano_nome?: string; // Nome do plano (join)
  status: 'ativo' | 'inativo' | 'suspenso';
  created_at: string;
  updated_at: string;
}

export type Programa = {
  id: string;
  nome: string;
  descricao?: string;
  versao?: string;
  executable_hash?: string;
  status: 'ativo' | 'inativo';
  created_at: string;
  updated_at: string;
}

export type Plano = {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  duracao_dias: number;
  max_dispositivos: number;
  max_offline_dias: number;
  features?: string[];
  status: 'ativo' | 'inativo';
  programas?: Programa[];
  created_at: string;
}

export type PlanoPrograma = {
  plano_id: string;
  programa_id: string;
  created_at: string;
}

export type Assinatura = {
  id: string;
  cliente_id: string;
  cliente?: Cliente;
  plano_id: string;
  plano?: Plano;
  data_inicio: string;
  data_fim: string;
  auto_renovar: boolean;
  status: 'ativa' | 'expirada' | 'cancelada' | 'suspensa';
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export type Licenca = {
  id: string;
  assinatura_id: string;
  assinatura?: Assinatura;
  programa_id: string;
  programa?: Programa;
  license_key: string;
  device_fingerprint?: any;
  status: 'ativa' | 'inativa' | 'bloqueada' | 'transferida';
  max_offline_hours: number;
  ultimo_acesso?: string;
  ultimo_ip?: string;
  created_at: string;
}

export type SecurityEvent = {
  id: string;
  license_key: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  details: any;
  ip_address?: string;
  automated_action?: string;
  created_at: string;
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'cliente';
  cliente_id?: string;
}