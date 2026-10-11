using { br.com.calazanstec as m } from '../../db/tratativa';

namespace br.com.calazanstec.analitico.operacional;

view TratativasAbertasView as
  select from m.Tratativas {
    key 'TOTAL' as id : String(10),
        count(*) as total : Integer
  }
  where status = 'Aberta' or status = 'Em andamento';

view TratativasVencidasView as
  select from m.Tratativas {
    key 'TOTAL' as id : String(10),
        count(*) as total : Integer
  }
  where (status = 'Aberta' or status = 'Em andamento')
    and dataPrevistaConclusao < cast($now as Date);

view AcoesEmAndamentoView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key 'TOTAL' as id : String(10),
        count(*) as total : Integer
  }
  where a.status = 'Em andamento'
    and (t.status = 'Aberta' or t.status = 'Em andamento');

view PendenciasPorResponsavelView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key a.responsavel as responsavel : String(50),
        count(*) as total : Integer
  }
  where (a.status = 'Pendente' or a.status = 'Em andamento')
    and (t.status = 'Aberta' or t.status = 'Em andamento')
  group by a.responsavel;

view PendenciasPorUnidadeAreaView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key coalesce(t.unidade, 'Sem Unidade') as unidade : String(100),
    key coalesce(t.area, 'Sem Área') as area : String(100),
        count(*) as total : Integer
  }
  where (a.status = 'Pendente' or a.status = 'Em andamento')
    and (t.status = 'Aberta' or t.status = 'Em andamento')
  group by coalesce(t.unidade, 'Sem Unidade'), coalesce(t.area, 'Sem Área');

view PendenciasPorUnidadeView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key coalesce(t.unidade, 'Sem Unidade') as unidade : String(100),
        count(*) as total : Integer
  }
  where (a.status = 'Pendente' or a.status = 'Em andamento')
    and (t.status = 'Aberta' or t.status = 'Em andamento')
  group by coalesce(t.unidade, 'Sem Unidade');
