using { br.com.calazanstec as m } from '../../db/tratativa';

namespace br.com.calazanstec.analitico.eficacia;

/** R15 c (016): Pareto de Causas Raízes agrupado pela macrocausa registrada nas Tratativas. */
view ParetoCausasRaizesView as
  select from m.Tratativas {
    key categoriaCausaRaiz,
        count(*) as total : Integer
  }
  where categoriaCausaRaiz is not null
  group by categoriaCausaRaiz;
