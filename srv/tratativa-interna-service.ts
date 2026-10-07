import cds from '@sap/cds';
import { alterarCriticidade } from './tratativa/criticidade';
import type { TipoAutor } from './tratativa/abertura';

/** Operações internas: só repassa os argumentos ao domínio. Sem endpoint. */
export default class TratativaInternaService extends cds.ApplicationService {
  async init() {
    this.on('alterarCriticidade', async (req) => {
      const { codigo, criticidade, autor, tipoAutor } = req.data as {
        codigo: string; criticidade: string; autor: string; tipoAutor: TipoAutor;
      };
      await alterarCriticidade(codigo, criticidade, { id: autor, tipo: tipoAutor });
    });
    return super.init();
  }
}
