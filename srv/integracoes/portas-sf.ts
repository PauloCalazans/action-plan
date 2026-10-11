export type SituacaoColaboradorSF = 'Ativo' | 'Inativo';

export interface DadosColaboradorSF {
  matricula: string;
  nome: string;
  email: string;
  codigoUnidade: string;
  codigoArea: string;
  matriculaGestor: string | null;
  situacao: SituacaoColaboradorSF;
}

export interface FiltroColaboradoresSF {
  termo?: string;
  codigoUnidade?: string;
  codigoArea?: string;
  apenasAtivos?: boolean;
}

export interface DadosAreaSF {
  codigoArea: string;
  nomeArea: string;
  ativa: boolean;
}

export interface DadosUnidadeSF {
  codigoUnidade: string;
  nomeUnidade: string;
  ativa?: boolean;
  areas: DadosAreaSF[];
}

export interface ProvedorPessoasPort {
  obterColaborador(matricula: string): Promise<DadosColaboradorSF | null>;
  buscarColaboradores(filtro: FiltroColaboradoresSF): Promise<DadosColaboradorSF[]>;
}

export interface ProvedorEstruturaPort {
  listarEstrutura(nivelUnidade: string, nivelArea: string): Promise<DadosUnidadeSF[]>;
}
