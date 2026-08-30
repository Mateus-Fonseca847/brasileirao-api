# Dicionário de Dados — API do Brasileirão

## 1. Objetivo

Este documento define as entidades, campos, relacionamentos e regras de dados utilizados pela API do Brasileirão.

O dicionário representa o modelo normalizado do domínio e serve como referência para:

- modelagem do banco de dados;
- implementação do schema Prisma;
- processos de importação;
- validação dos dados;
- implementação dos endpoints REST;
- documentação OpenAPI.

Os nomes definidos neste documento representam conceitos internos do sistema e não necessariamente os nomes originais encontrados nas fontes externas.

---

# 2. Princípios do modelo

## 2.1 Dados históricos não serão inventados

Quando uma informação não estiver disponível ou não puder ser validada, ela deverá ser armazenada como ausente.

Exemplo:

possession = null

não significa:

possession = 0

O primeiro caso representa ausência de informação.

O segundo representa um valor real igual a zero.

---

## 2.2 Dados raw permanecem imutáveis

Os arquivos da camada raw não devem ser modificados para corrigir inconsistências.

Correções conhecidas devem ser registradas através dos mecanismos de normalização, auditoria e proveniência do projeto.

---

## 2.3 Identificadores internos não dependem das fontes

Clubes, jogadores, temporadas e partidas possuirão identificadores internos.

Identificadores utilizados por fontes externas não serão utilizados como chave principal do banco.

---

## 2.4 Rodada não identifica permanentemente uma partida

A auditoria histórica demonstrou que partidas adiadas ou remarcadas podem aparecer associadas a rodadas diferentes entre fontes.

Consequentemente:

round != match identity

A rodada deverá ser tratada como metadado da partida.

---

## 2.5 Resultados oficiais e resultados em campo podem ser diferentes

Determinadas partidas podem possuir decisão administrativa posterior.

O modelo deve permitir distinguir:

- resultado ocorrido em campo;
- resultado oficial utilizado pela competição.

Essa separação é necessária para preservar corretamente casos históricos.

---

# 3. Season

Representa uma edição do Campeonato Brasileiro Série A.

Exemplos:

- Brasileirão 2003;
- Brasileirão 2016;
- Brasileirão 2024;
- Brasileirão 2026.

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno da temporada |
| year | integer | sim | Ano da temporada |
| status | enum | sim | Estado atual da temporada |
| start_date | date | não | Data de início da competição |
| end_date | date | não | Data de encerramento |
| teams_count | integer | não | Quantidade de clubes participantes |
| created_at | datetime | sim | Data de criação do registro |
| updated_at | datetime | sim | Última atualização |

## Valores de status

- in_progress
- validation
- finished

## Restrições

year deve ser único.

Exemplo:

2003 → finished  
2024 → finished  
2026 → in_progress

---

# 4. Team

Representa um clube participante do Campeonato Brasileiro Série A.

A entidade utiliza identidade canônica independente da forma como cada fonte escreve o nome do clube.

Exemplo:

CR Flamengo  
Flamengo RJ  
Flamengo

devem apontar para:

flamengo

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno |
| slug | string | sim | Identificador textual canônico |
| name | string | sim | Nome principal do clube |
| short_name | string | não | Nome curto utilizado para apresentação |
| state | string | não | Estado brasileiro associado ao clube |
| created_at | datetime | sim | Data de criação |
| updated_at | datetime | sim | Última atualização |

## Restrições

slug deve ser único.

Exemplos de slug:

flamengo  
palmeiras  
internacional  
athletico-pr  
sao-paulo

Aliases encontrados nas fontes continuam sendo administrados pela camada de normalização.

---

# 5. SeasonTeam

Representa a participação de um clube em determinada temporada.

Essa tabela resolve a relação muitos-para-muitos entre temporadas e clubes.

Exemplo:

Season 2024
    ↕
SeasonTeam
    ↕
Flamengo

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno |
| season_id | UUID | sim | Temporada |
| team_id | UUID | sim | Clube participante |
| created_at | datetime | sim | Data de criação |

## Restrições

A combinação:

season_id + team_id

deve ser única.

Um clube não pode aparecer duas vezes como participante da mesma temporada.

---

# 6. Match

Representa uma partida vinculada a uma temporada.

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno |
| season_id | UUID | sim | Temporada |
| round | integer | não | Rodada associada à partida |
| match_date | date | não | Data da partida |
| kickoff_time | time | não | Horário da partida |
| home_team_id | UUID | sim | Clube mandante |
| away_team_id | UUID | sim | Clube visitante |
| home_goals | integer | não | Gols oficiais do mandante |
| away_goals | integer | não | Gols oficiais do visitante |
| played_home_goals | integer | não | Gols do mandante no resultado ocorrido em campo |
| played_away_goals | integer | não | Gols do visitante no resultado ocorrido em campo |
| stadium | string | não | Estádio |
| status | enum | sim | Estado da partida |
| created_at | datetime | sim | Data de criação |
| updated_at | datetime | sim | Última atualização |

## Status inicialmente previstos

- scheduled
- finished
- cancelled
- annulled
- not_played

## Resultado oficial

Os campos:

home_goals  
away_goals

representam o resultado oficial reconhecido pela competição.

Na maioria das partidas:

home_goals = played_home_goals  
away_goals = played_away_goals

Porém isso não é obrigatório.

Exemplo histórico:

Brasiliense 2 x 2 Vasco em campo

resultado oficial:

Brasiliense 0 x 1 Vasco

Nesse caso:

played_home_goals = 2  
played_away_goals = 2

home_goals = 0  
away_goals = 1

## Regras

home_team_id não pode ser igual a away_team_id.

Gols não podem possuir valor negativo.

A rodada não faz parte da identidade permanente da partida.

---

# 7. MatchTeamStat

Representa as estatísticas de um clube dentro de uma partida.

Uma partida poderá possuir até dois registros principais:

Match
├── estatísticas do mandante
└── estatísticas do visitante

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno |
| match_id | UUID | sim | Partida |
| team_id | UUID | sim | Clube |
| shots | integer | não | Finalizações |
| possession | decimal | não | Percentual de posse de bola |
| yellow_cards | integer | não | Cartões amarelos |
| red_cards | integer | não | Cartões vermelhos |
| created_at | datetime | sim | Data de criação |
| updated_at | datetime | sim | Última atualização |

## Restrições

A combinação:

match_id + team_id

deve ser única.

O team_id deve corresponder ao mandante ou visitante da partida.

## Valores ausentes

Estatísticas não disponíveis historicamente devem permanecer:

null

e não:

0

---

# 8. Standing

Representa a classificação oficial de um clube em determinada temporada.

A classificação não deverá ser reconstruída exclusivamente através dos resultados das partidas porque decisões administrativas podem alterar pontos ou posições.

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno |
| season_id | UUID | sim | Temporada |
| team_id | UUID | sim | Clube |
| position | integer | sim | Posição oficial |
| points | integer | sim | Pontuação oficial |
| played | integer | sim | Jogos considerados |
| wins | integer | sim | Vitórias |
| draws | integer | sim | Empates |
| losses | integer | sim | Derrotas |
| goals_for | integer | sim | Gols marcados |
| goals_against | integer | sim | Gols sofridos |
| goal_difference | integer | sim | Saldo de gols |
| points_adjustment | integer | sim | Ajuste administrativo de pontos |
| created_at | datetime | sim | Data de criação |
| updated_at | datetime | sim | Última atualização |

## points_adjustment

Valor padrão:

0

Pode representar punições ou ajustes administrativos.

Exemplo conceitual:

pontos obtidos em campo = 48  
ajuste administrativo = -4  
pontos oficiais = 44

O campo points sempre representa a pontuação oficial da tabela.

## Restrições

A combinação:

season_id + team_id

deve ser única.

A combinação:

season_id + position

também deve ser única para uma classificação final validada.

---

# 9. Player

Representa um jogador identificado nas fontes utilizadas pelo projeto.

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno |
| name | string | sim | Nome do jogador |
| birth_date | date | não | Data de nascimento, quando disponível |
| nationality | string | não | Nacionalidade, quando disponível |
| created_at | datetime | sim | Data de criação |
| updated_at | datetime | sim | Última atualização |

## Observação

O nome isoladamente não deve ser considerado uma identidade universal garantida.

Jogadores homônimos poderão exigir atributos adicionais para desambiguação.

---

# 10. PlayerSeasonTeam

Representa o vínculo de um jogador com um clube durante uma temporada.

Essa entidade é necessária porque:

- um jogador participa de várias temporadas;
- um clube possui vários jogadores;
- um jogador pode representar mais de um clube na mesma temporada.

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno |
| season_id | UUID | sim | Temporada |
| player_id | UUID | sim | Jogador |
| team_id | UUID | sim | Clube |
| created_at | datetime | sim | Data de criação |

## Restrições

A combinação:

season_id + player_id + team_id

deve ser única.

---

# 11. PlayerSeasonStat

Representa estatísticas agregadas de um jogador em uma temporada e por clube.

A entidade permite armazenar artilharia mesmo quando eventos individuais de todos os gols não estiverem disponíveis.

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno |
| season_id | UUID | sim | Temporada |
| player_id | UUID | sim | Jogador |
| team_id | UUID | sim | Clube |
| goals | integer | não | Quantidade de gols |
| appearances | integer | não | Partidas disputadas, quando disponível |
| created_at | datetime | sim | Data de criação |
| updated_at | datetime | sim | Última atualização |

## Restrições

A combinação:

season_id + player_id + team_id

deve ser única.

## Motivação

A existência dessa entidade é independente de GoalEvent.

Isso permite representar, por exemplo:

Jogador X  
Temporada 2007  
15 gols

mesmo quando o projeto ainda não possui a lista completa das 15 partidas em que esses gols aconteceram.

---

# 12. GoalEvent

Representa um evento individual de gol quando essa informação estiver disponível.

Nem todas as temporadas possuirão cobertura desse nível de detalhe.

## Campos

| Campo | Tipo conceitual | Obrigatório | Descrição |
|---|---|---:|---|
| id | UUID | sim | Identificador interno |
| match_id | UUID | sim | Partida |
| team_id | UUID | sim | Clube responsável pelo gol |
| player_id | UUID | não | Jogador identificado |
| minute | integer | não | Minuto do gol |
| stoppage_time | integer | não | Acréscimo, quando disponível |
| is_penalty | boolean | não | Indica gol de pênalti |
| is_own_goal | boolean | não | Indica gol contra |
| created_at | datetime | sim | Data de criação |

## Observação

player_id poderá ser null caso o evento de gol seja conhecido, mas o jogador não possa ser identificado de forma confiável.

---

# 13. Qualidade e cobertura

A qualidade dos dados possui duas características distintas.

## Validação

Indica se o dado foi verificado.

Valores conceituais:

- verified
- provisional
- unverified

## Cobertura

Indica a disponibilidade do conjunto de informações.

Valores conceituais:

- complete
- partial
- unavailable

Esses conceitos não devem ser confundidos.

Um conjunto pode ser:

verified + partial

quando todos os registros existentes foram validados, mas a cobertura histórica não é completa.

---

# 14. Dados derivados

Algumas informações não precisam necessariamente ser armazenadas de forma duplicada.

Exemplos:

saldo de gols:

goals_for - goals_against

gols de uma equipe em uma partida:

derivados de Match.home_goals ou Match.away_goals

quantidade total de gols de uma partida:

home_goals + away_goals

A persistência de campos derivados deverá ser utilizada apenas quando existir justificativa técnica ou necessidade de preservar o valor oficial publicado.

---

# 15. Relacionamentos principais

Season
├── SeasonTeam
│   └── Team
├── Match
│   ├── Team (home)
│   ├── Team (away)
│   ├── MatchTeamStat
│   └── GoalEvent
├── Standing
│   └── Team
├── PlayerSeasonTeam
│   ├── Player
│   └── Team
└── PlayerSeasonStat
    ├── Player
    └── Team

---

# 16. Cardinalidades

## Season → Match

Uma temporada possui várias partidas.

Uma partida pertence a uma única temporada.

Relação:

1:N

## Season ↔ Team

Uma temporada possui vários clubes.

Um clube participa de várias temporadas.

Relação:

N:N

resolvida através de:

SeasonTeam

## Match ↔ Team

Cada partida possui exatamente:

1 mandante  
1 visitante

Um clube participa de várias partidas.

## Match → MatchTeamStat

Uma partida pode possuir até dois registros principais de estatísticas por equipe.

## Season → Standing

Uma temporada possui vários registros de classificação.

Cada clube possui no máximo um registro oficial de classificação por temporada.

## Player ↔ Team ↔ Season

O vínculo é representado por:

PlayerSeasonTeam

## Match → GoalEvent

Uma partida pode possuir zero ou vários eventos individuais de gol.

---

# 17. Integridade histórica

Temporadas com status:

finished

devem ser consideradas históricas.

Após importação e validação, alterações nesses dados deverão ocorrer apenas por processos controlados.

Correções históricas não devem sobrescrever silenciosamente a proveniência das informações.

---

# 18. Escopo inicial de persistência

A primeira versão do banco deverá priorizar:

1. Season
2. Team
3. SeasonTeam
4. Match
5. MatchTeamStat
6. Standing

Em seguida:

7. Player
8. PlayerSeasonTeam
9. PlayerSeasonStat
10. GoalEvent

Essa ordem permite primeiro disponibilizar a base estrutural da competição e os resultados históricos já validados.

---

# 19. Próxima etapa

Com o modelo conceitual definido, a próxima etapa consiste em transformar este dicionário em um modelo relacional concreto.

Esse modelo será utilizado para definir:

- tabelas;
- chaves primárias;
- chaves estrangeiras;
- índices;
- constraints;
- enums;
- relacionamentos Prisma.

Somente após essa definição será iniciada a persistência dos dados históricos no PostgreSQL.