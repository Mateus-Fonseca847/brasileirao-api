# Modelo Relacional de Jogadores e Gols — Planejado para V2

## 1. Objetivo

Este documento complementa `RELATIONAL_MODEL.md` e descreve um modelo planejado para a V2.

As entidades abaixo não fazem parte do escopo público da V1.

O documento define o modelo relacional das entidades relacionadas a:

- jogadores;
- vínculo entre jogador, clube e temporada;
- estatísticas agregadas de jogadores;
- artilharia;
- eventos individuais de gol.

As entidades descritas aqui serão incorporadas ao `schema.prisma` somente em uma fase posterior.

O modelo foi projetado levando em consideração que a cobertura histórica dessas informações não é uniforme.

Portanto, a ausência de um evento individual não implica necessariamente que o gol não ocorreu.

---

# 2. Entidades planejadas para V2

Serão modeladas em uma fase futura:

1. players;
2. player_season_teams;
3. player_season_stats;
4. goal_events.

Essas entidades se relacionam com estruturas já definidas:

- seasons;
- teams;
- matches.

---

# 3. Princípio fundamental

A API deve distinguir:

estatística agregada

de:

evento individual

Exemplo:

um jogador pode possuir:

15 gols na temporada

mesmo que o projeto não possua os 15 eventos individuais correspondentes.

Consequentemente:

PlayerSeasonStat

não depende de:

GoalEvent

Essa separação é necessária principalmente para temporadas históricas com cobertura incompleta.

---

# 4. Tabela players

Representa uma pessoa identificada como jogador em uma ou mais fontes utilizadas pelo projeto.

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| name | VARCHAR(200) | não | |
| birth_date | DATE | sim | |
| nationality | VARCHAR(100) | sim | |
| created_at | TIMESTAMPTZ | não | |
| updated_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Regras

name não pode ser vazio.

O campo:

name

não será UNIQUE.

## Motivo

Jogadores diferentes podem possuir o mesmo nome.

Portanto:

nome != identidade

A identidade interna será sempre:

players.id

## Exemplo

Dois registros poderão possuir:

João Silva

sem que isso signifique que representam a mesma pessoa.

Informações adicionais como:

- data de nascimento;
- nacionalidade;
- identificadores externos;

poderão auxiliar futuras rotinas de desambiguação.

## Índices

Índice:

name

Esse índice poderá auxiliar:

- buscas internas;
- normalização;
- consultas administrativas.

---

# 5. Identidade de jogadores

A normalização de jogadores apresenta um problema diferente da normalização de clubes.

Clubes possuem um conjunto relativamente pequeno de identidades conhecidas.

Jogadores possuem:

- milhares de registros;
- nomes semelhantes;
- abreviações;
- apelidos;
- homônimos;
- alterações de grafia entre fontes.

Consequentemente, não será criada uma regra como:

UNIQUE(name)

Também não será assumido que duas ocorrências com o mesmo nome representam automaticamente o mesmo jogador.

A reconciliação de jogadores deverá ser tratada posteriormente através de um processo específico.

---

# 6. Tabela player_season_teams

Representa o vínculo entre:

jogador  
temporada  
clube

Exemplo:

Ronaldo  
2009  
Corinthians

A entidade permite registrar que determinado jogador representou determinado clube durante uma edição do campeonato.

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| season_id | UUID | não | FOREIGN KEY |
| player_id | UUID | não | FOREIGN KEY |
| team_id | UUID | não | FOREIGN KEY |
| created_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Chaves estrangeiras

season_id -> seasons.id

player_id -> players.id

team_id -> teams.id

## Restrição de unicidade

UNIQUE:

season_id + player_id + team_id

Isso impede a duplicação do mesmo vínculo.

## Exemplo

Um jogador poderá possuir:

2024 + jogador X + clube A

e também:

2024 + jogador X + clube B

caso tenha atuado por dois clubes durante a mesma temporada.

Isso é permitido.

---

# 7. Por que o clube faz parte do vínculo

Não seria suficiente armazenar apenas:

player_id + season_id

porque jogadores podem trocar de clube durante uma mesma edição.

Exemplo conceitual:

Jogador X
    |
    ├── Clube A — primeira parte da temporada
    |
    └── Clube B — restante da temporada

Por isso:

season + player

não identifica completamente o vínculo esportivo.

O modelo utiliza:

season + player + team

---

# 8. Índices de player_season_teams

UNIQUE:

season_id + player_id + team_id

Índice:

player_id

Permite consultar o histórico de um jogador.

Índice:

team_id

Permite consultar jogadores relacionados a determinado clube.

Índice composto:

season_id + team_id

Permite consultar jogadores associados a um clube em determinada temporada.

---

# 9. Tabela player_season_stats

Representa estatísticas agregadas de um jogador em uma temporada por clube.

A V2 poderá ser orientada inicialmente para:

artilharia

mas a tabela poderá ser expandida futuramente.

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| season_id | UUID | não | FOREIGN KEY |
| player_id | UUID | não | FOREIGN KEY |
| team_id | UUID | não | FOREIGN KEY |
| goals | INTEGER | sim | |
| appearances | INTEGER | sim | |
| created_at | TIMESTAMPTZ | não | |
| updated_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Chaves estrangeiras

season_id -> seasons.id

player_id -> players.id

team_id -> teams.id

## Restrição de unicidade

UNIQUE:

season_id + player_id + team_id

## Regras

Quando preenchido:

goals >= 0

appearances >= 0

---

# 10. Null em estatísticas de jogadores

A mesma política utilizada nas estatísticas das partidas será aplicada aqui.

Exemplo:

appearances = null

significa:

quantidade de partidas não disponível ou não validada

Enquanto:

appearances = 0

significa:

valor real igual a zero

Os dois estados não podem ser tratados como equivalentes.

---

# 11. Jogador que atuou por dois clubes

Considere:

Jogador X

que marcou:

5 gols pelo Clube A

e:

3 gols pelo Clube B

na mesma temporada.

O banco deverá armazenar:

player_season_stats

linha 1:

season = temporada  
player = jogador X  
team = clube A  
goals = 5

linha 2:

season = temporada  
player = jogador X  
team = clube B  
goals = 3

O total da temporada poderá ser derivado:

5 + 3 = 8 gols

Isso evita perder a informação de quais clubes foram representados.

---

# 12. Artilharia

A classificação de artilheiros poderá ser construída a partir de:

player_season_stats

Exemplo conceitual:

SELECT
    player,
    SUM(goals)
FROM player_season_stats
WHERE season = 2024
GROUP BY player
ORDER BY SUM(goals) DESC

A API poderá, portanto, disponibilizar futuramente:

GET /seasons/2024/top-scorers

sem depender da existência de todos os registros de `goal_events`.

---

# 13. Tabela goal_events

Representa um evento individual de gol identificado dentro de uma partida.

Nem todas as partidas e temporadas possuirão esse nível de detalhe.

## Estrutura

| Coluna | Tipo PostgreSQL | Null | Regra |
|---|---|---:|---|
| id | UUID | não | PRIMARY KEY |
| match_id | UUID | não | FOREIGN KEY |
| scoring_team_id | UUID | não | FOREIGN KEY |
| player_id | UUID | sim | FOREIGN KEY |
| minute | INTEGER | sim | |
| stoppage_time | INTEGER | sim | |
| event_type | goal_event_type | não | |
| created_at | TIMESTAMPTZ | não | |

## Chave primária

id

## Chaves estrangeiras

match_id -> matches.id

scoring_team_id -> teams.id

player_id -> players.id

player_id poderá ser null.

---

# 14. Enum goal_event_type

Representa o tipo do gol.

Valores iniciais:

REGULAR

PENALTY

OWN_GOAL

## REGULAR

Gol marcado normalmente durante a partida.

## PENALTY

Gol marcado através de cobrança de pênalti.

## OWN_GOAL

Gol contra.

---

# 15. Significado de scoring_team_id

Este campo possui uma definição importante.

scoring_team_id representa:

o clube ao qual o gol foi creditado no placar

e não necessariamente:

o clube do jogador que tocou por último na bola.

Isso é especialmente importante para gols contra.

Exemplo:

Flamengo x Palmeiras

Jogador do Palmeiras marca um gol contra.

O placar recebe:

gol do Flamengo

Portanto:

scoring_team_id = Flamengo

event_type = OWN_GOAL

player_id = jogador do Palmeiras

Isso permite que a soma dos eventos por `scoring_team_id` seja comparada corretamente com o placar da partida.

---

# 16. Por que não utilizar apenas team_id

O nome:

team_id

seria ambíguo em um evento de gol contra.

Poderia significar:

- clube do jogador;
- clube beneficiado pelo gol;
- clube registrado pela fonte.

Por isso o modelo utiliza explicitamente:

scoring_team_id

A semântica do campo fica definida de forma inequívoca.

---

# 17. Jogador desconhecido

Poderão existir situações em que:

- a partida é conhecida;
- o gol é conhecido;
- o clube beneficiado é conhecido;
- o jogador não pôde ser identificado de forma confiável.

Nesse caso:

player_id = null

O evento continua válido.

Exemplo:

match_id = partida conhecida

scoring_team_id = Flamengo

player_id = null

minute = 75

event_type = REGULAR

A ausência da identificação do jogador não exige apagar o evento.

---

# 18. Minuto do gol

O campo:

minute

representa o minuto regulamentar registrado.

Exemplo:

45

Para gols em acréscimos:

45+3

será representado como:

minute = 45

stoppage_time = 3

Outro exemplo:

90+6

será armazenado como:

minute = 90

stoppage_time = 6

---

# 19. Regras temporais do gol

Quando preenchido:

minute >= 0

stoppage_time >= 0

Não será estabelecido inicialmente um limite rígido como:

minute <= 90

porque partidas podem possuir:

- acréscimos;
- formatos históricos;
- situações extraordinárias.

A validação temporal detalhada poderá ser aplicada durante a normalização.

---

# 20. Integridade de scoring_team_id

O campo:

scoring_team_id

deve corresponder a um dos clubes participantes da partida.

Ou seja:

scoring_team_id = matches.home_team_id

ou:

scoring_team_id = matches.away_team_id

Essa regra será validada inicialmente através da:

- camada de importação;
- camada de serviço;
- auditoria;
- testes.

---

# 21. Gol contra

Um gol contra demonstra por que:

scoring_team_id

e:

player_id

não necessariamente representam entidades do mesmo clube.

Exemplo:

Partida:

Flamengo x Palmeiras

Jogador:

Jogador Y do Palmeiras

evento:

OWN_GOAL

O banco poderá possuir:

scoring_team_id = Flamengo

player_id = Jogador Y

Isso é intencional.

Não deverá existir uma regra exigindo que o jogador pertença ao `scoring_team_id` em eventos classificados como:

OWN_GOAL

---

# 22. Restrições de unicidade em goal_events

Não será criada inicialmente uma restrição como:

UNIQUE(match_id, player_id, minute)

porque ela seria insegura.

É possível haver:

- dois gols do mesmo jogador no mesmo minuto oficial;
- jogador não identificado;
- minuto ausente;
- registros com diferentes níveis de precisão.

A identidade do evento será:

goal_events.id

---

# 23. Índices de goal_events

Índice:

match_id

Principal utilização:

buscar os gols de uma partida.

Índice:

player_id

Utilização:

buscar gols associados a um jogador.

Índice:

scoring_team_id

Utilização:

buscar gols creditados a um clube.

Índice composto:

match_id + scoring_team_id

Pode auxiliar validações dos gols de cada equipe em uma partida.

---

# 24. Relação entre placar e GoalEvent

Quando a cobertura de eventos for considerada completa, será possível auditar:

quantidade de GoalEvent
por scoring_team_id

contra:

home_goals

e:

away_goals

Exemplo:

Match:

Flamengo 2 x 1 Palmeiras

Eventos:

Flamengo -> 2

Palmeiras -> 1

Resultado:

eventos compatíveis com placar

Entretanto, essa validação só poderá ser aplicada às temporadas cuja cobertura de eventos tenha sido considerada completa.

---

# 25. GoalEvent não é fonte do placar oficial

O placar oficial continuará armazenado em:

matches.home_goals

e:

matches.away_goals

GoalEvent representa detalhamento do resultado.

Isso significa que:

Match

não depende de:

GoalEvent

para existir.

Essa decisão é necessária porque várias temporadas possuem resultados completos, mas não possuem eventos individuais completos.

---

# 26. PlayerSeasonStat não deve ser recalculado cegamente de GoalEvent

Mesmo quando existirem eventos individuais, não será assumido automaticamente que:

SUM(goal_events) = player_season_stats.goals

sem antes validar a cobertura da fonte.

Exemplo:

player_season_stats.goals = 15

mas apenas:

12 GoalEvent

foram encontrados.

Isso pode significar:

cobertura parcial de eventos

e não:

erro na artilharia

A auditoria deverá determinar qual interpretação é correta.

---

# 27. Relacionamentos principais

Player
    |
    | 1
    |
    | N
PlayerSeasonTeam
   /        \
  /          \
Season      Team


Player
    |
    | 1
    |
    | N
PlayerSeasonStat
   /        \
  /          \
Season      Team


Match
    |
    | 1
    |
    | N
GoalEvent
   /      \
  /        \
Team      Player

---

# 28. Cardinalidades

## Player -> PlayerSeasonTeam

Relação:

1:N

Um jogador poderá representar vários clubes e temporadas.

---

## Season -> PlayerSeasonTeam

Relação:

1:N

Uma temporada poderá possuir vários vínculos de jogadores.

---

## Team -> PlayerSeasonTeam

Relação:

1:N

Um clube poderá possuir vários jogadores relacionados a diferentes temporadas.

---

## Player -> PlayerSeasonStat

Relação:

1:N

Um jogador poderá possuir várias linhas de estatísticas históricas.

---

## Match -> GoalEvent

Relação:

1:N

Uma partida poderá possuir:

0

ou vários eventos de gol.

---

## Player -> GoalEvent

Relação:

1:N opcional

Um jogador poderá possuir vários gols.

Um GoalEvent poderá não possuir jogador identificado.

---

## Team -> GoalEvent

Relação:

1:N

Um clube poderá receber crédito por vários gols.

---

# 29. Política de exclusão

Assim como no núcleo histórico, os relacionamentos utilizarão inicialmente uma política equivalente a:

ON DELETE RESTRICT

ou:

ON DELETE NO ACTION

Exemplo:

não deverá ser possível apagar um jogador que possua eventos históricos associados sem uma operação explícita de correção.

Também não deverá ser possível apagar uma partida e eliminar silenciosamente seus eventos.

---

# 30. Integridade garantida pelo PostgreSQL

O PostgreSQL deverá garantir:

- UUIDs;
- chaves primárias;
- chaves estrangeiras;
- NOT NULL;
- restrições de unicidade;
- tipos;
- integridade referencial;
- valores numéricos simples quando possível.

---

# 31. Integridade dependente da aplicação

Algumas regras continuarão sendo verificadas na aplicação.

Exemplos:

jogador representava determinado clube naquela temporada

scoring_team_id pertence à partida

jogador de um OWN_GOAL pode pertencer ao adversário

estatística agregada possui cobertura validada

evento individual pertence corretamente à temporada da partida

Essas regras serão verificadas através de:

- normalização;
- scripts de importação;
- Zod;
- serviços;
- testes;
- auditorias.

---

# 32. Ordem de criação

Depois das tabelas do núcleo, a ordem recomendada será:

1. players
2. player_season_teams
3. player_season_stats
4. goal_events

Dependências:

player_season_teams
-> players
-> seasons
-> teams

player_season_stats
-> players
-> seasons
-> teams

goal_events
-> matches
-> teams
-> players

---

# 33. Ordem de importação

A importação deverá ocorrer somente depois que:

- temporadas;
- clubes;
- participantes;
- partidas;

já existirem.

Ordem conceitual:

1. importar jogadores identificados;
2. criar vínculos entre jogadores, clubes e temporadas;
3. importar estatísticas agregadas disponíveis;
4. importar eventos individuais de gols disponíveis;
5. executar auditorias de consistência.

---

# 34. Consultas futuras suportadas

A modelagem permitirá futuramente consultas como:

GET /players

GET /players/:id

GET /players/:id/seasons

GET /seasons/:year/top-scorers

GET /seasons/:year/teams/:team/players

GET /matches/:id/goals

GET /players/:id/goals

Esses endpoints ainda não fazem parte desta etapa de implementação.

---

# 35. Relação com o modelo completo

Com as entidades deste documento, o domínio principal passa a ser:

Season
├── SeasonTeam
│   └── Team
│
├── Match
│   ├── Team (home)
│   ├── Team (away)
│   ├── MatchTeamStat
│   └── GoalEvent
│       ├── Team
│       └── Player
│
├── Standing
│   └── Team
│
├── PlayerSeasonTeam
│   ├── Player
│   └── Team
│
└── PlayerSeasonStat
    ├── Player
    └── Team

---

# 36. Resultado da modelagem relacional planejada

O modelo relacional completo planejado para a V2 poderá possuir:

seasons

teams

season_teams

matches

match_team_stats

standings

players

player_season_teams

player_season_stats

goal_events

Essas tabelas representam a base estrutural necessária para disponibilizar, em fase posterior:

- temporadas;
- clubes;
- partidas;
- resultados;
- classificações;
- estatísticas por equipe;
- jogadores;
- artilharia;
- eventos individuais de gol.

---

# 37. Próxima etapa

Com o modelo conceitual e o modelo relacional definidos, a próxima fase será iniciar a infraestrutura real de persistência.

Serão configurados:

PostgreSQL

e:

Prisma

Em seguida será criado:

prisma/schema.prisma

traduzindo as decisões documentadas para modelos executáveis.

A primeira migration somente será criada após a validação do schema Prisma.
