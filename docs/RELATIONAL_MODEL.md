# Modelo Relacional — API do Brasileirão

## 1. Objetivo

Este documento transforma o modelo conceitual definido em `DATA_DICTIONARY.md` em uma estrutura relacional preparada para implementação no PostgreSQL e posterior mapeamento através do Prisma.

O modelo relacional define:

- tabelas;
- colunas;
- tipos;
- chaves primárias;
- chaves estrangeiras;
- restrições de unicidade;
- índices;
- regras de integridade;
- relacionamentos.

Nesta primeira etapa são modeladas as entidades centrais da API:

1. seasons;
2. teams;
3. season_teams;
4. matches;
5. match_team_stats;
6. standings.

Jogadores e eventos individuais serão adicionados em uma etapa posterior.

---

# 2. Convenções

## 2.1 Nomes no PostgreSQL

As tabelas utilizarão:

snake_case

e nomes no plural.

Exemplos:

seasons  
teams  
season_teams  
matches  
match_team_stats  
standings

As colunas também utilizarão:

snake_case

Exemplos:

season_id  
home_team_id  
created_at

---

## 2.2 Nomes no Prisma

Posteriormente, o Prisma utilizará modelos no singular e em PascalCase.

Exemplo conceitual:

Season -> seasons  
Team -> teams  
SeasonTeam -> season_teams  
Match -> matches

O mapeamento entre os nomes do Prisma e do PostgreSQL será feito no `schema.prisma`.

---

## 2.3 Identificadores

As entidades principais utilizarão UUID como identificador interno.

Motivos:

- não depender de IDs fornecidos por fontes externas;
- evitar colisões entre diferentes fontes;
- permitir importações futuras;
- desacoplar a identidade do registro de sua posição no banco;
- facilitar eventual integração entre datasets.

Exemplo:

id UUID PRIMARY KEY

Os UUIDs poderão ser gerados através da aplicação e do Prisma.

---

## 2.4 Datas de auditoria

As tabelas mutáveis possuirão:

created_at  
updated_at

O tipo utilizado no PostgreSQL será:

TIMESTAMPTZ

Isso permite registrar os instantes de criação e atualização de forma independente do fuso horário da aplicação.

---

# 3. Enum season_status

Representa o estado de uma temporada.

Valores:

IN_PROGRESS  
VALIDATION  
FINISHED

Significados:

IN_PROGRESS  
Temporada atualmente em disputa.

VALIDATION  
Temporada encerrada esportivamente, mas ainda passando pelo processo de validação dos dados.

FINISHED  
Temporada encerrada e validada.

---

# 4. Enum match_status

Representa o estado de uma partida.

Valores:

SCHEDULED  
FINISHED  
CANCELLED  
ANNULLED  
NOT_PLAYED

Significados:

SCHEDULED  
Partida prevista, mas ainda não disputada.

FINISHED  
Partida disputada e concluída.

CANCELLED  
Partida cancelada.

ANNULLED  
Partida disputada, porém posteriormente anulada.

NOT_PLAYED  
Partida prevista oficialmente, mas que não chegou a ser disputada.

---

# 5. Tabela seasons

Representa uma edição do Campeonato Brasileiro Série A.

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| year | INTEGER | não | UNIQUE |
| status | season_status | não | |
| start_date | DATE | sim | |
| end_date | DATE | sim | |
| teams_count | INTEGER | sim | |
| created_at | TIMESTAMPTZ | não | |
| updated_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Restrições

year deve ser único.

year deve ser maior ou igual a 2003 dentro do escopo histórico inicial do projeto.

Quando preenchido:

teams_count > 0

Quando ambas estiverem disponíveis:

end_date >= start_date

## Índices

O índice criado pela restrição UNIQUE de year já atende à principal consulta:

buscar temporada pelo ano.

Exemplo:

2024

---

# 6. Tabela teams

Representa a identidade canônica de um clube.

A tabela não deverá armazenar todas as variações de nome encontradas nas fontes.

Essas variações continuam sendo tratadas pela camada de normalização.

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| slug | VARCHAR(100) | não | UNIQUE |
| name | VARCHAR(150) | não | |
| short_name | VARCHAR(100) | sim | |
| state | VARCHAR(2) | sim | |
| created_at | TIMESTAMPTZ | não | |
| updated_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Restrições

slug deve ser único.

name não pode ser vazio.

Quando state estiver preenchido, deverá representar uma sigla de UF com dois caracteres.

Exemplos:

RJ  
SP  
MG  
RS

## Exemplos de slug

flamengo  
palmeiras  
internacional  
athletico-pr  
sao-paulo

## Índices

UNIQUE:

slug

Índice adicional recomendado:

name

Esse índice poderá auxiliar buscas administrativas ou internas por nome.

---

# 7. Tabela season_teams

Representa a participação de um clube em uma determinada temporada.

Resolve a relação muitos-para-muitos entre:

seasons

e:

teams

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| season_id | UUID | não | FOREIGN KEY |
| team_id | UUID | não | FOREIGN KEY |
| created_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Chaves estrangeiras

season_id -> seasons.id

team_id -> teams.id

## Restrição de unicidade

UNIQUE:

season_id + team_id

Isso impede que o mesmo clube seja cadastrado duas vezes na mesma temporada.

## Índices

Índice:

season_id

Índice:

team_id

A restrição UNIQUE em:

season_id + team_id

também cria uma estrutura de índice útil para consultas combinadas.

---

# 8. Tabela matches

Representa uma partida relacionada a uma temporada.

A identidade da partida será exclusivamente seu UUID interno.

Nenhuma combinação de:

rodada  
mandante  
visitante  
data  
placar

será utilizada como chave primária.

Isso é necessário porque a auditoria histórica encontrou:

- partidas remarcadas;
- diferenças de rodada entre fontes;
- partidas anuladas;
- partidas repetidas;
- erros de mandante e visitante em fontes externas.

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| season_id | UUID | não | FOREIGN KEY |
| round | INTEGER | sim | |
| match_date | DATE | sim | |
| kickoff_time | TIME | sim | |
| home_team_id | UUID | não | FOREIGN KEY |
| away_team_id | UUID | não | FOREIGN KEY |
| home_goals | INTEGER | sim | |
| away_goals | INTEGER | sim | |
| played_home_goals | INTEGER | sim | |
| played_away_goals | INTEGER | sim | |
| stadium | VARCHAR(200) | sim | |
| status | match_status | não | |
| created_at | TIMESTAMPTZ | não | |
| updated_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Chaves estrangeiras

season_id -> seasons.id

home_team_id -> teams.id

away_team_id -> teams.id

## Regras de integridade

home_team_id != away_team_id

Quando preenchidos:

home_goals >= 0

away_goals >= 0

played_home_goals >= 0

played_away_goals >= 0

Quando round estiver preenchida:

round > 0

## Resultado oficial

Os campos:

home_goals  
away_goals

representam o resultado oficial reconhecido pela competição.

## Resultado ocorrido em campo

Os campos:

played_home_goals  
played_away_goals

representam o placar registrado em campo.

Na maioria das partidas os dois conjuntos serão iguais.

Entretanto, casos administrativos poderão apresentar valores diferentes.

Exemplo histórico:

Brasiliense 2 x 2 Vasco

resultado em campo:

played_home_goals = 2  
played_away_goals = 2

resultado oficial:

home_goals = 0  
away_goals = 1

## Ausência de resultado

Uma partida ainda não disputada poderá possuir:

home_goals = null  
away_goals = null

Null não significa zero.

## Integridade da temporada

home_team_id e away_team_id deverão representar clubes participantes da temporada indicada por season_id.

Na primeira implementação, essa regra será validada durante:

- importação;
- camada de serviço;
- testes de integridade.

A relação `season_teams` será utilizada para verificar essa condição.

## Por que não existe UNIQUE entre temporada e equipes

Não será criada uma restrição como:

UNIQUE(season_id, home_team_id, away_team_id)

porque o histórico do campeonato possui situações em que mais de um registro físico pode existir para o mesmo confronto.

O caso de partidas anuladas e posteriormente repetidas torna essa restrição insegura.

A identidade real continuará sendo:

matches.id

## Índices

Índice:

season_id

Principal utilização:

consultar partidas de uma temporada.

Índice:

home_team_id

Índice:

away_team_id

Utilização:

consultar partidas de um clube.

Índice composto:

season_id + round

Utilização:

consultar uma rodada de determinada temporada.

Índice:

match_date

Utilização:

consultar partidas por data.

---

# 9. Tabela match_team_stats

Representa as estatísticas de uma equipe em uma partida.

Uma partida poderá possuir:

0 registros

quando não houver estatísticas disponíveis,

1 registro

caso apenas uma equipe possua dados confirmados,

ou normalmente:

2 registros

um para cada clube participante.

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| match_id | UUID | não | FOREIGN KEY |
| team_id | UUID | não | FOREIGN KEY |
| shots | INTEGER | sim | |
| possession | NUMERIC(5,2) | sim | |
| yellow_cards | INTEGER | sim | |
| red_cards | INTEGER | sim | |
| created_at | TIMESTAMPTZ | não | |
| updated_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Chaves estrangeiras

match_id -> matches.id

team_id -> teams.id

## Restrição de unicidade

UNIQUE:

match_id + team_id

Isso impede dois registros estatísticos independentes para a mesma equipe na mesma partida.

## Regras

Quando preenchido:

shots >= 0

yellow_cards >= 0

red_cards >= 0

possession >= 0

possession <= 100

## Integridade da equipe

team_id deverá corresponder a:

matches.home_team_id

ou:

matches.away_team_id

Essa regra envolve outra linha da tabela matches e será validada inicialmente na camada de importação e de serviço.

## Null versus zero

Exemplo:

shots = null

significa:

estatística indisponível

Enquanto:

shots = 0

significa:

zero finalizações registradas

Esses estados não podem ser tratados como equivalentes.

## Índices

UNIQUE:

match_id + team_id

Índice:

team_id

Permite consultar estatísticas históricas de determinada equipe.

---

# 10. Tabela standings

Representa a classificação oficial de cada clube em uma temporada.

A tabela deverá preservar a classificação oficial em vez de depender exclusivamente de cálculos derivados das partidas.

Isso permite representar decisões administrativas.

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| season_id | UUID | não | FOREIGN KEY |
| team_id | UUID | não | FOREIGN KEY |
| position | INTEGER | não | |
| points | INTEGER | não | |
| played | INTEGER | não | |
| wins | INTEGER | não | |
| draws | INTEGER | não | |
| losses | INTEGER | não | |
| goals_for | INTEGER | não | |
| goals_against | INTEGER | não | |
| goal_difference | INTEGER | não | |
| points_adjustment | INTEGER | não | DEFAULT 0 |
| created_at | TIMESTAMPTZ | não | |
| updated_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Chaves estrangeiras

season_id -> seasons.id

team_id -> teams.id

## Restrições de unicidade

UNIQUE:

season_id + team_id

Um clube possui apenas uma linha oficial de classificação por temporada.

UNIQUE:

season_id + position

Uma posição da tabela pertence a apenas um clube.

## Regras

position > 0

played >= 0

wins >= 0

draws >= 0

losses >= 0

goals_for >= 0

goals_against >= 0

goal_difference poderá ser:

positivo  
zero  
negativo

points_adjustment poderá ser:

positivo  
zero  
negativo

## Integridade dos jogos

Em condições normais:

played = wins + draws + losses

Essa regra deverá ser verificada durante a importação e auditoria.

## Saldo de gols

Em condições normais:

goal_difference = goals_for - goals_against

O valor continuará sendo armazenado porque representa um campo oficial e frequentemente publicado junto com a classificação.

## Pontuação

points representa a pontuação oficial.

points_adjustment representa apenas o ajuste administrativo conhecido.

Exemplo:

pontuação esportiva = 48

points_adjustment = -4

points = 44

## Índices

Índice:

season_id

A restrição:

UNIQUE(season_id, position)

já favorece a consulta da classificação ordenada por temporada e posição.

Índice:

team_id

Permite consultar classificações históricas de um clube.

---

# 11. Relacionamentos

## seasons -> season_teams

Relação:

1:N

Uma temporada possui vários participantes.

---

## teams -> season_teams

Relação:

1:N

Um clube pode participar de várias temporadas.

---

## seasons <-> teams

Conceitualmente:

N:N

Resolvida através de:

season_teams

---

## seasons -> matches

Relação:

1:N

Uma temporada possui várias partidas.

---

## teams -> matches

Um clube poderá aparecer como:

home_team

ou:

away_team

em várias partidas.

---

## matches -> match_team_stats

Relação:

1:N

Uma partida pode possuir até um registro estatístico por equipe participante.

---

## teams -> match_team_stats

Relação:

1:N

Um clube possui registros estatísticos em várias partidas.

---

## seasons -> standings

Relação:

1:N

Uma temporada possui várias posições de classificação.

---

## teams -> standings

Relação:

1:N

Um clube poderá possuir uma classificação em várias temporadas.

---

# 12. Representação simplificada

season
    |
    | 1
    |
    | N
season_team
    |
    | N
    |
    | 1
team


season
    |
    | 1
    |
    | N
match
   / \
  /   \
home  away
 |      |
team   team


match
    |
    | 1
    |
    | N
match_team_stat
    |
    | N
    |
    | 1
team


season
    |
    | 1
    |
    | N
standing
    |
    | N
    |
    | 1
team

---

# 13. Política de exclusão

Dados históricos validados não deverão ser removidos automaticamente em cascata.

Por esse motivo, a estratégia inicial para relacionamentos históricos será equivalente a:

ON DELETE RESTRICT

ou:

ON DELETE NO ACTION

Exemplo:

não deve ser possível remover Flamengo da tabela teams enquanto existirem partidas históricas relacionadas ao clube.

A exclusão acidental de uma temporada também não deverá apagar automaticamente milhares de partidas.

Operações destrutivas deverão ser explícitas e controladas.

---

# 14. Política de atualização

Alterações em identificadores primários não serão uma operação normal do sistema.

IDs UUID devem ser tratados como imutáveis.

Dados históricos com temporada:

FINISHED

também deverão sofrer alterações apenas através de processos controlados.

---

# 15. Índices iniciais

Resumo dos índices previstos.

## seasons

UNIQUE(year)

## teams

UNIQUE(slug)

INDEX(name)

## season_teams

UNIQUE(season_id, team_id)

INDEX(season_id)

INDEX(team_id)

## matches

INDEX(season_id)

INDEX(home_team_id)

INDEX(away_team_id)

INDEX(season_id, round)

INDEX(match_date)

## match_team_stats

UNIQUE(match_id, team_id)

INDEX(team_id)

## standings

UNIQUE(season_id, team_id)

UNIQUE(season_id, position)

INDEX(season_id)

INDEX(team_id)

---

# 16. Integridade que será garantida pelo PostgreSQL

O PostgreSQL deverá garantir diretamente sempre que possível:

- chaves primárias;
- chaves estrangeiras;
- unicidade;
- tipos;
- valores obrigatórios;
- integridade referencial;
- restrições numéricas simples.

Exemplos:

season.year único

team.slug único

season_team sem duplicidade

standing sem duas equipes na mesma posição

match_team_stat sem duas estatísticas da mesma equipe na mesma partida

---

# 17. Integridade que também dependerá da aplicação

Algumas regras envolvem múltiplas relações ou contexto histórico e não serão delegadas apenas a constraints simples.

Exemplos:

mandante precisa participar da temporada

visitante precisa participar da temporada

estatística precisa pertencer a um dos dois clubes da partida

temporada finished não deve ser modificada arbitrariamente

resultado administrativo deve preservar placar em campo

dados históricos corrigidos precisam manter proveniência

Essas regras serão protegidas por:

- scripts de importação;
- camada de serviço;
- validação com Zod;
- testes automatizados;
- auditorias.

---

# 18. Ordem de criação das tabelas

As tabelas deverão ser criadas respeitando suas dependências.

Ordem:

1. seasons
2. teams
3. season_teams
4. matches
5. match_team_stats
6. standings

Motivo:

season_teams depende de seasons e teams.

matches depende de seasons e teams.

match_team_stats depende de matches e teams.

standings depende de seasons e teams.

---

# 19. Ordem inicial de importação

A importação dos dados deverá seguir uma ordem semelhante:

1. criar temporadas;
2. criar clubes canônicos;
3. relacionar clubes às temporadas;
4. importar partidas validadas;
5. importar estatísticas disponíveis;
6. importar classificações oficiais.

Essa ordem reduz a possibilidade de registros órfãos.

---

# 20. Relação com o pipeline atual

O fluxo completo passa a ser:

Fonte externa
        |
        v
Dados raw
        |
        v
Parser
        |
        v
Normalização
        |
        v
Validação cruzada
        |
        v
Modelo relacional
        |
        v
Prisma
        |
        v
PostgreSQL
        |
        v
API REST

Os arquivos raw continuam sendo a evidência original.

Os scripts atuais continuam responsáveis por interpretar e validar as fontes.

O banco armazenará a representação consolidada e normalizada utilizada pela API.

---

# 21. Escopo desta etapa

Este documento define apenas o núcleo relacional necessário para:

- temporadas;
- clubes;
- participantes;
- partidas;
- resultados;
- estatísticas por equipe;
- classificação.

Ainda não foram modelados relacionalmente:

- jogadores;
- vínculos de jogadores;
- estatísticas agregadas de jogadores;
- eventos individuais de gol.

Essas entidades serão adicionadas após a validação do núcleo.

---

# 22. Próxima etapa

Depois da aprovação deste modelo relacional, o próximo passo será traduzir essas decisões para o Prisma.

Será criado:

prisma/schema.prisma

contendo inicialmente:

Season

Team

SeasonTeam

Match

MatchTeamStat

Standing

Também serão configurados:

- enums;
- relações;
- índices;
- restrições de unicidade;
- nomes físicos das tabelas;
- tipos específicos do PostgreSQL.

A criação das primeiras migrations ocorrerá somente depois que o schema Prisma estiver validado.