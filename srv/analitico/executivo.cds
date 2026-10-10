using { br.com.calazanstec as m } from '../../db/tratativa';

namespace br.com.calazanstec.analitico.executivo;

view BacklogTotalView as
  select from m.Tratativas as t
  left join m.Acoes as a
    on a.tratativa.codigo = t.codigo
    and (a.status = 'Pendente' or a.status = 'Em andamento') {
    key 'TOTAL' as id : String(10),
        count(distinct t.codigo) + count(a.codigo) as total : Integer
  }
  where t.status = 'Aberta' or t.status = 'Em andamento';
