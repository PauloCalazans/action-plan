import cds from '@sap/cds';

export interface Comando {
  evento: string;
  entidade?: string;
  forUpdate: boolean;
}

const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const ESCRITAS = ['UPDATE', 'CREATE', 'DELETE'];

// Verdadeiro quando a primeira leitura de Tratativas pede forUpdate e nenhuma escrita veio antes (D9).
export function bloqueiaAntesDeEscrever(comandos: Comando[]): boolean {
  for (const c of comandos) {
    if (ESCRITAS.includes(c.evento)) return false;
    if (c.entidade === TRATATIVAS) return c.evento === 'READ' && c.forUpdate;
  }
  return false;
}

export interface Espiao {
  comandos: Comando[];
  limpar(): void;
  falharEm(evento: string, entidade: string): void;
  naoFalhar(): void;
}

// Registra uma vez o hook do banco (chamar num beforeAll depois de cds.test(...)).
export function instalarEspiao(): Espiao {
  const comandos: Comando[] = [];
  let falha: { evento: string; entidade: string } | undefined;
  cds.db.before('*', (req) => {
    const q = req.query as { SELECT?: { forUpdate?: unknown } } | undefined;
    const comando: Comando = {
      evento: req.event,
      entidade: req.target?.name,
      forUpdate: Boolean(q?.SELECT?.forUpdate),
    };
    comandos.push(comando);
    if (falha && comando.evento === falha.evento && comando.entidade === falha.entidade) {
      throw new Error('falha simulada');
    }
  });
  return {
    comandos,
    limpar: () => {
      comandos.length = 0;
    },
    falharEm: (evento, entidade) => {
      falha = { evento, entidade };
    },
    naoFalhar: () => {
      falha = undefined;
    },
  };
}
