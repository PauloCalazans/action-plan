using { br.com.calazanstec as m } from '../../db/tratativa';

namespace br.com.calazanstec.analitico.executivo;

view VolumePorOrigemView as
  select from m.Tratativas {
    key coalesce(origem, 'Sem Origem') as origem : String(100),
        count(*) as total : Integer,
        cast(0.00 as Decimal(5,2)) as percentual : Decimal(5,2)
  }
  group by origem;

view PrincipaisDesviosView as
  select from m.Tratativas {
    key coalesce(origem, 'Sem Origem') as origem : String(100),
        count(*) as totalDesvios : Integer
  }
  where (status = 'Aberta' or status = 'Em andamento')
    and dataPrevistaConclusao < $now
  group by origem;

view BacklogTotalView as
  select from m.Tratativas as t
  left join m.Acoes as a
    on a.tratativa.codigo = t.codigo
    and (a.status = 'Pendente' or a.status = 'Em andamento') {
    key 'TOTAL' as id : String(10),
        count(distinct t.codigo) + count(a.codigo) as total : Integer
  }
  where t.status = 'Aberta' or t.status = 'Em andamento';

view EvidenciasPendentesView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key 'TOTAL' as id : String(10),
        count(*) as total : Integer
  }
  where a.evidenciaObrigatoria = true
    and (a.status = 'Pendente' or a.status = 'Em andamento')
    and (t.status = 'Aberta' or t.status = 'Em andamento')
    and not exists (
      select 1 from m.Evidencias as e
      where e.acao.codigo = a.codigo
        and e.ativo = true
    );
