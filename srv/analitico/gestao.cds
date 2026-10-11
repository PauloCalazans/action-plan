using { br.com.calazanstec as m } from '../../db/tratativa';

namespace br.com.calazanstec.analitico.gestao;

view TratativasPorOrigemView as
  select from m.Tratativas {
    key origem : String(100),
        count(*) as total : Integer
  }
  group by origem;

view TratativasPorCriticidadeView as
  select from m.Tratativas {
    key criticidade,
        count(*) as total : Integer
  }
  group by criticidade;

view RankingAreasView as
  select from m.Tratativas {
    key area : String(100),
        count(*) as total : Integer
  }
  where status = 'Aberta' or status = 'Em andamento'
  group by area;
