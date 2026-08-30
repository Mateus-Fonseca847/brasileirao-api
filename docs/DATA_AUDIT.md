# Auditoria dos Dados — API do Brasileirão

## 1. Objetivo

Este documento registra os resultados das auditorias executadas sobre datasets externos utilizados ou avaliados pelo projeto.

A auditoria possui como objetivo determinar a cobertura real dos dados antes que eles sejam normalizados ou armazenados no banco de dados da API.

O processo permite identificar:

* temporadas disponíveis;
* quantidade de partidas;
* cobertura de estatísticas;
* cobertura de gols;
* cobertura de cartões;
* valores ausentes;
* possíveis placeholders;
* inconsistências;
* exceções históricas.

---

# 2. Primeira fonte auditada

```text
source_id: adaoduque_brasileirao
```

Arquivos analisados:

```text
campeonato-brasileiro-full.csv
campeonato-brasileiro-estatisticas-full.csv
campeonato-brasileiro-gols.csv
campeonato-brasileiro-cartoes.csv
```

A auditoria foi executada através de:

```text
scripts/audit/audit-adaoduque.ts
```

O relatório gerado automaticamente é armazenado em:

```text
data/audit/adaoduque-audit.json
```

---

# 3. Quantidade total de registros

Na versão auditada foram encontrados:

```text
Partidas:     8785
Estatísticas: 17570
Gols:         9861
Cartões:      20953
```

A fonte possui partidas entre:

```text
2003 → 2024
```

A versão analisada não possui partidas da temporada 2025.

---

# 4. Cobertura de partidas

Foram encontradas as seguintes quantidades:

| Temporada | Partidas |
| --------- | -------: |
| 2003      |      552 |
| 2004      |      552 |
| 2005      |      462 |
| 2006      |      380 |
| 2007      |      380 |
| 2008      |      380 |
| 2009      |      380 |
| 2010      |      380 |
| 2011      |      380 |
| 2012      |      380 |
| 2013      |      380 |
| 2014      |      380 |
| 2015      |      380 |
| 2016      |      379 |
| 2017      |      380 |
| 2018      |      380 |
| 2019      |      380 |
| 2020      |      380 |
| 2021      |      380 |
| 2022      |      380 |
| 2023      |      380 |
| 2024      |      380 |

A quantidade de partidas varia nos primeiros anos devido à quantidade diferente de participantes da competição.

A temporada 2016 possui 379 partidas disputadas.

A partida entre Chapecoense e Atlético-MG da última rodada não foi disputada.

Portanto:

```text
379 partidas em 2016 != erro da fonte
```

---

# 5. Problema identificado nos registros de estatísticas

O arquivo de estatísticas possui duas linhas relacionadas a praticamente todas as partidas históricas.

Entretanto, a existência dessas linhas não significa que as estatísticas estejam realmente disponíveis.

Entre 2003 e 2013 foram encontrados registros equivalentes a:

```text
chutes = 0
posse_de_bola = valor ausente
```

para todas as equipes analisadas.

Esses registros foram interpretados como placeholders e não como estatísticas esportivas reais.

Consequentemente:

```text
2003–2013
```

não serão considerados anos com cobertura de posse ou chutes através desta fonte.

---

# 6. Cobertura de posse e chutes

Cada partida pode gerar até dois registros estatísticos:

```text
partida
├── equipe mandante
└── equipe visitante
```

Assim, uma temporada com 380 partidas pode possuir até:

```text
760 registros por equipe
```

Os resultados encontrados foram:

| Temporada | Registros esperados | Posse válida | Chutes positivos | Situação inicial |
| --------- | ------------------: | -----------: | ---------------: | ---------------- |
| 2003      |                1104 |            0 |                0 | indisponível     |
| 2004      |                1104 |            0 |                0 | indisponível     |
| 2005      |                 924 |            0 |                0 | indisponível     |
| 2006      |                 760 |            0 |                0 | indisponível     |
| 2007      |                 760 |            0 |                0 | indisponível     |
| 2008      |                 760 |            0 |                0 | indisponível     |
| 2009      |                 760 |            0 |                0 | indisponível     |
| 2010      |                 760 |            0 |                0 | indisponível     |
| 2011      |                 760 |            0 |                0 | indisponível     |
| 2012      |                 760 |            0 |                0 | indisponível     |
| 2013      |                 760 |            0 |                0 | indisponível     |
| 2014      |                 760 |           32 |               32 | parcial          |
| 2015      |                 760 |          760 |              760 | alta cobertura   |
| 2016      |                 758 |          758 |              758 | alta cobertura   |
| 2017      |                 760 |          758 |              758 | parcial          |
| 2018      |                 760 |          760 |              760 | alta cobertura   |
| 2019      |                 760 |          714 |              714 | parcial          |
| 2020      |                 760 |          758 |              758 | parcial          |
| 2021      |                 760 |          760 |              760 | alta cobertura   |
| 2022      |                 760 |          760 |              760 | alta cobertura   |
| 2023      |                 760 |          760 |              760 | alta cobertura   |
| 2024      |                 760 |            0 |                0 | indisponível     |

---

# 7. Observação sobre chutes

O indicador utilizado nesta primeira auditoria é:

```text
chutes > 0
```

Portanto, ele não deve ser interpretado automaticamente como cobertura definitiva.

É teoricamente possível que uma equipe tenha terminado uma partida com zero finalizações.

Por esse motivo, a cobertura de chutes ainda deverá passar por uma validação posterior.

O indicador é utilizado principalmente para detectar períodos em que todos os registros foram preenchidos artificialmente com zero.

---

# 8. Descoberta sobre 2014

A temporada 2014 representa uma transição importante no dataset.

Foram encontradas:

```text
380 partidas
760 linhas estatísticas
```

mas somente:

```text
32 registros com posse válida
32 registros com chutes positivos
```

Isso indica que a estrutura de estatísticas existe para toda a temporada, porém os dados avançados estão disponíveis somente para uma pequena parte dela.

A temporada será inicialmente classificada como:

```text
PARTIAL
```

para posse e chutes.

---

# 9. Cobertura de 2015

Em 2015 foram encontrados:

```text
380 partidas
760 registros com posse
760 registros com chutes positivos
897 gols no placar
897 eventos de gol
```

Essa correspondência indica uma cobertura significativamente melhor.

A temporada será tratada como possuindo alta cobertura, sujeita às validações posteriores.

---

# 10. Cobertura de 2016

Foram encontradas:

```text
379 partidas
758 registros com posse
758 registros com chutes positivos
912 gols no placar
912 eventos de gol
```

Os 758 registros estatísticos correspondem exatamente a:

```text
379 × 2 = 758
```

Portanto, os dados estatísticos encontrados possuem cobertura compatível com todas as partidas disputadas registradas no dataset.

---

# 11. Cobertura incompleta em algumas temporadas

Algumas temporadas apresentam pequenas ou médias lacunas.

### 2017

```text
esperado: 760
encontrado: 758
```

### 2019

```text
esperado: 760
encontrado: 714
```

### 2020

```text
esperado: 760
encontrado: 758
```

Essas diferenças não serão preenchidas artificialmente.

Os registros ausentes deverão permanecer identificados como indisponíveis até que outra fonte confiável seja encontrada.

---

# 12. Cobertura de 2021 a 2023

As temporadas apresentaram:

```text
760 registros esperados
760 registros com posse
760 registros com chutes positivos
```

para cada ano.

Isso indica alta cobertura na versão atualmente auditada.

---

# 13. Situação de 2024

Apesar de o dataset possuir:

```text
380 partidas
760 linhas de estatísticas
```

não foram encontrados valores válidos para posse ou chutes através dos critérios da auditoria.

Foram encontrados:

```text
929 gols no placar
929 eventos individuais de gol
2096 cartões
```

Consequentemente, para esta fonte:

```text
2024 partidas       = disponível
2024 resultados     = disponível
2024 gols           = disponível
2024 cartões        = disponível
2024 posse          = indisponível
2024 chutes         = indisponível
```

Uma segunda fonte poderá posteriormente complementar os dados ausentes.

---

# 14. Cobertura de gols individuais

Entre 2003 e 2013:

```text
eventos de gol = 0
```

A partir de 2014, a quantidade de eventos registrados coincidiu com a quantidade total de gols dos placares em todas as temporadas auditadas.

Exemplos:

```text
2014
gols no placar = 860
eventos = 860

2015
gols no placar = 897
eventos = 897

2024
gols no placar = 929
eventos = 929
```

Isso representa um forte indicador de cobertura dos eventos de gol entre:

```text
2014 → 2024
```

Uma auditoria posterior deverá verificar também:

* gols contra;
* gols de pênalti;
* identificação de jogadores;
* minutos;
* duplicidades.

---

# 15. Cobertura de cartões

Não foram encontrados eventos de cartão entre:

```text
2003 → 2013
```

Foram encontrados registros a partir de:

```text
2014
```

A existência dos registros confirma disponibilidade, mas ainda não garante completude.

Uma auditoria específica dos cartões deverá verificar:

* cartões amarelos;
* cartões vermelhos;
* segundos amarelos;
* jogadores;
* clubes;
* partidas;
* possíveis duplicidades.

---

# 16. Cobertura preliminar da fonte

Com base na primeira auditoria:

| Período   | Resultados | Gols individuais | Cartões      | Posse          | Chutes         |
| --------- | ---------- | ---------------- | ------------ | -------------- | -------------- |
| 2003–2013 | disponível | indisponível     | indisponível | indisponível   | indisponível   |
| 2014      | disponível | alta cobertura   | disponível   | parcial        | parcial        |
| 2015–2016 | disponível | alta cobertura   | disponível   | alta cobertura | alta cobertura |
| 2017      | disponível | alta cobertura   | disponível   | quase completa | quase completa |
| 2018      | disponível | alta cobertura   | disponível   | alta cobertura | alta cobertura |
| 2019      | disponível | alta cobertura   | disponível   | parcial        | parcial        |
| 2020      | disponível | alta cobertura   | disponível   | quase completa | quase completa |
| 2021–2023 | disponível | alta cobertura   | disponível   | alta cobertura | alta cobertura |
| 2024      | disponível | alta cobertura   | disponível   | indisponível   | indisponível   |

Esses estados ainda são preliminares.

Nenhum deles substitui as etapas posteriores de validação cruzada.

---

# 17. Política adotada após a auditoria

O projeto não exigirá artificialmente que todas as temporadas possuam os mesmos campos preenchidos.

Uma partida poderá possuir:

```text
shots: null
possession: null
```

quando a informação não estiver disponível.

A ausência será considerada um estado válido do dado histórico.

---

# 18. Resultado da primeira auditoria

A primeira auditoria confirmou que um único dataset não será suficiente para atender integralmente ao escopo da API entre 2003 e a temporada atual.

A estratégia do projeto continuará utilizando múltiplas fontes:

```text
fonte A
   +
fonte B
   +
validação
   ↓
base histórica consolidada
```

A utilização de fontes adicionais será feita para complementar dados ausentes, e não para substituir silenciosamente registros existentes.

# 19. Validação cruzada da temporada 2024

Após a auditoria individual das fontes, foi realizada uma comparação entre os dados de partidas da temporada 2024 provenientes de:

- Dataset de Adão Duque;
- OpenFootball.

O objetivo foi verificar se os resultados utilizados pelo projeto coincidiam entre duas fontes independentes.

## Processo de comparação

Antes da comparação, os nomes das equipes precisaram ser normalizados.

As fontes utilizam representações diferentes para os mesmos clubes.

Exemplos:

- Flamengo ↔ CR Flamengo
- Palmeiras ↔ SE Palmeiras
- Atletico-MG ↔ CA Mineiro
- Internacional ↔ SC Internacional
- Sao Paulo ↔ São Paulo FC

Foi criado o arquivo:

data/mappings/team-aliases.json

para associar diferentes representações ao mesmo identificador canônico.

A lógica de normalização foi implementada em:

scripts/normalization/team-names.ts

Depois da normalização, a estratégia de correspondência das partidas foi refinada durante a auditoria histórica.

Inicialmente, a rodada fazia parte da identidade utilizada na comparação. Essa abordagem foi abandonada após a identificação de partidas adiadas ou remarcadas que apareciam associadas a rodadas diferentes entre as fontes.

Consequentemente:

rodada != identidade permanente da partida

O comparador passou a trabalhar com os identificadores canônicos das equipes e a tratar individualmente as ocorrências de cada confronto.

Também foi necessário evitar estruturas em que uma única chave pudesse sobrescrever partidas repetidas. Em 2009, por exemplo, dois registros entre Botafogo e Flamengo expuseram essa limitação.

A estratégia atual agrupa as ocorrências do mesmo par de clubes e compara o resultado associado a cada equipe, consumindo cada ocorrência somente uma vez.

A rodada permanece armazenada como metadado da partida, mas não é utilizada como identificador permanente.

A condição de mandante e visitante também permanece preservada nos dados das fontes. Divergências conhecidas nessa informação devem ser registradas separadamente como correções de proveniência e não corrigidas diretamente nos arquivos raw.

## Resultado

A comparação encontrou:

| Métrica | Resultado |
|---|---:|
| Partidas no dataset de Adão Duque | 380 |
| Partidas no OpenFootball | 380 |
| Partidas correspondentes | 380 |
| Placares iguais | 380 |
| Placares divergentes | 0 |
| Partidas somente no dataset de Adão Duque | 0 |
| Partidas somente no OpenFootball | 0 |
| Equipes sem alias conhecido | 0 |

## Conclusão

Todas as 380 partidas da temporada 2024 puderam ser relacionadas entre as duas fontes.

Além disso:

380 de 380 placares coincidiram.

Portanto, os resultados da temporada 2024 passaram pela primeira validação cruzada do projeto.

Para os dados básicos de partidas e resultados de 2024, o projeto passa a considerar que existe forte evidência de consistência entre as fontes analisadas.

Essa validação cobre:

- clubes participantes;
- quantidade de partidas;
- rodada;
- confronto;
- gols do mandante;
- gols do visitante;
- resultado final.

Ela não valida automaticamente:

- posse de bola;
- chutes;
- cartões;
- eventos individuais de gol;
- artilharia.

Esses conjuntos de dados possuem processos próprios de auditoria e validação.

## Relatório automatizado

O resultado completo da comparação é armazenado em:

data/audit/source-comparison-2024.json

A comparação pode ser reproduzida através de:

npm run compare:2024

# 20. Validação histórica consolidada — 2018 a 2024

Após a implementação de um comparador reutilizável por temporada, os resultados das partidas entre 2018 e 2024 foram confrontados entre duas fontes independentes:

- Dataset de Adão Duque;
- OpenFootball.

Antes da comparação, diferenças nos nomes dos clubes foram resolvidas através da camada de aliases mantida em:

data/mappings/team-aliases.json

A comparação foi executada individualmente para cada temporada.

## Resultado por temporada

| Temporada | Partidas comparadas | Placares iguais | Divergências | Status |
|---|---:|---:|---:|---|
| 2018 | 380 | 380 | 0 | VERIFIED |
| 2019 | 380 | 380 | 0 | VERIFIED |
| 2020 | 380 | 380 | 0 | VERIFIED |
| 2021 | 380 | 380 | 0 | VERIFIED |
| 2022 | 380 | 380 | 0 | VERIFIED |
| 2023 | 380 | 380 | 0 | VERIFIED |
| 2024 | 380 | 380 | 0 | VERIFIED |

## Resultado consolidado

Foram verificadas:

7 temporadas

totalizando:

2660 partidas.

Foram encontrados:

2660 placares coincidentes

e:

0 divergências.

Também não permaneceram:

- partidas exclusivas do dataset de Adão Duque;
- partidas exclusivas do OpenFootball;
- aliases de clubes pendentes;
- linhas de partidas do OpenFootball sem interpretação.

Consequentemente, os resultados das temporadas entre 2018 e 2024 receberam o estado:

VERIFIED

no contexto da validação cruzada entre essas duas fontes.

## Observação sobre a temporada 2020

A temporada 2020 foi concluída durante o ano-calendário de 2021 devido à alteração do calendário causada pela pandemia.

O projeto implementa uma regra específica para associar partidas realizadas em janeiro e fevereiro de 2021 à temporada 2020.

A validação completa das 380 partidas dessa temporada confirma que essa regra está funcionando corretamente para o dataset analisado.

## Limite desta validação

O status VERIFIED desta etapa refere-se especificamente a:

- participantes dos confrontos;
- rodadas utilizadas para relacionamento;
- mando de campo;
- quantidade de partidas;
- gols do mandante;
- gols do visitante;
- placar final.

Esta validação não implica automaticamente que estejam verificadas:

- estatísticas de posse;
- chutes;
- cartões;
- eventos individuais de gol;
- artilharia.

Esses conjuntos de dados possuem auditorias próprias.

## Automação

Cada temporada pode ser comparada através de:

npm run compare:season -- ANO

Exemplo:

npm run compare:season -- 2022

O relatório consolidado pode ser reconstruído através de:

npm run audit:validation-summary

O arquivo consolidado é armazenado em:

data/audit/source-comparison-summary-2018-2024.json

# 21. Validação histórica da temporada 2017

A temporada 2017 foi utilizada como temporada piloto para introdução do formato histórico OpenFootball V0 no processo de validação da API.

## Fonte utilizada

Além do dataset de Adão Duque, foi utilizado:

OpenFootball / v0-format

O arquivo histórico analisado foi:

data/raw/openfootball-v0/2017_br1.txt

O formato utilizado nesta fonte é diferente do formato moderno do OpenFootball.

Por esse motivo foi criado um parser específico:

scripts/parsers/openfootball-v0.ts

## Auditoria do arquivo histórico

Antes da comparação entre fontes, o arquivo do OpenFootball V0 foi auditado isoladamente.

Foram encontrados:

| Métrica | Resultado |
|---|---:|
| Partidas | 380 |
| Equipes | 20 |
| Rodadas | 38 |
| Gols | 923 |
| Linhas não interpretadas | 0 |

A quantidade total de gols também coincidiu com a quantidade encontrada anteriormente no dataset de Adão Duque.

## Normalização dos clubes

Algumas equipes possuíam representações diferentes entre as fontes.

Entre os aliases identificados estavam:

- Atlético GO;
- Atlético MG;
- Atlético PR;
- Botafogo;
- Vasco da Gama;
- Ponte Preta.

Essas representações foram associadas aos identificadores canônicos mantidos em:

data/mappings/team-aliases.json

## Comparação entre as fontes

Após a normalização, foi executado:

npm run compare:season -- 2017

Resultado:

| Métrica | Resultado |
|---|---:|
| Partidas no dataset de Adão Duque | 380 |
| Partidas no OpenFootball V0 | 380 |
| Partidas correspondentes | 380 |
| Placares iguais | 380 |
| Placares divergentes | 0 |
| Partidas somente em Adão Duque | 0 |
| Partidas somente no OpenFootball | 0 |
| Aliases pendentes | 0 |
| Linhas não interpretadas | 0 |

## Conclusão

Todas as partidas da temporada 2017 puderam ser relacionadas entre as duas fontes.

Todos os 380 placares coincidiram.

Portanto, os resultados da temporada 2017 recebem o estado:

VERIFIED

no contexto da validação cruzada entre:

- adaoduque_brasileirao;
- openfootball_v0.

Esta validação se refere aos dados básicos das partidas e não implica validação automática das estatísticas avançadas.

## Importância técnica

A validação de 2017 também confirmou que o projeto consegue trabalhar com duas gerações diferentes do formato OpenFootball:

2003–2017 → OpenFootball V0

2018–2024 → OpenFootball atual

O comparador seleciona automaticamente a fonte e o parser apropriados de acordo com a temporada solicitada.


---

# Validação histórica global dos resultados — 2003 a 2024

Após a construção dos parsers, normalizadores, mapeamentos históricos e mecanismos de tratamento de exceções, foi executada uma regressão completa das temporadas do Campeonato Brasileiro Série A entre 2003 e 2024.

A auditoria foi executada através de:

npm run audit:historical-range -- 2003 2024

O relatório consolidado foi armazenado em:

data/audit/historical-validation-summary-2003-2024.json

## Resultado global

Foram analisadas:

22 temporadas

correspondentes ao período:

2003 → 2024

O dataset principal contém nesse intervalo:

8785 partidas oficiais

O resultado final da validação foi:

| Métrica | Resultado |
|---|---:|
| Temporadas analisadas | 22 |
| Temporadas validadas | 22 |
| Temporadas pendentes | 0 |
| Partidas oficiais | 8785 |
| Divergências de placar não explicadas | 0 |
| Aliases pendentes | 0 |
| Linhas não interpretadas | 0 |

Todas as temporadas analisadas atingiram o estado:

VALIDATED

## Exceções históricas modeladas

A validação não depende da alteração manual dos arquivos raw.

Situações excepcionais são mantidas em arquivos de mapeamento e tratadas explicitamente pelo pipeline.

### 2003 — correção conhecida de fonte

Partida:

Athletico-PR 5 x 2 Criciúma

O OpenFootball V0 registra incorretamente:

Athletico-PR 4 x 2 Criciúma

O resultado 5 x 2 foi confirmado através de fontes históricas independentes.

A correção permanece registrada separadamente como:

SOURCE_CORRECTION

### 2004 — correção conhecida de fonte

Partida:

Criciúma 2 x 1 Internacional

O OpenFootball V0 registra:

Criciúma 1 x 0 Internacional

O resultado histórico verificado é:

Criciúma 2 x 1 Internacional

A diferença também permanece registrada como:

SOURCE_CORRECTION

### 2005 — partidas anuladas

A temporada de 2005 possui 11 partidas originalmente disputadas que foram posteriormente anuladas pelo STJD no contexto do escândalo conhecido como Máfia do Apito.

Essas partidas foram posteriormente disputadas novamente.

Consequentemente, é necessário distinguir:

partidas físicas existentes na fonte histórica
!=
partidas oficiais consideradas na competição

Os 11 registros anulados são mantidos na camada raw e identificados através de:

data/mappings/annulled-matches.json

Após a exclusão lógica das partidas anuladas, ambas as fontes apresentam:

462 partidas oficiais

### 2005 — resultado administrativo

A partida entre Brasiliense e Vasco terminou em campo:

Brasiliense 2 x 2 Vasco

Entretanto, o resultado oficial da competição foi posteriormente definido administrativamente como:

Brasiliense 0 x 1 Vasco

O caso é tratado como:

ADMINISTRATIVE_OVERRIDE

e permanece registrado em:

data/mappings/administrative-results.json

Assim, o resultado disputado em campo não é apagado, enquanto o resultado oficial pode ser preservado separadamente.

### 2009 — orientação do confronto na fonte

Durante a validação foi identificado que o OpenFootball V0 apresenta o confronto de 19 de julho de 2009 como:

Botafogo 2 x 2 Flamengo

Fontes históricas registram a partida como:

Flamengo 2 x 2 Botafogo

O placar associado a cada equipe está correto, mas a condição de mandante e visitante aparece invertida na fonte.

A inconsistência é registrada separadamente em:

data/mappings/source-fixture-corrections.json

com o estado:

SOURCE_FIXTURE_CORRECTION

O arquivo raw original permanece inalterado.

### 2016 — 379 partidas

A temporada de 2016 possui:

379 partidas disputadas

A partida Chapecoense x Atlético-MG da última rodada não foi realizada.

Consequentemente:

379 partidas != dado incompleto

e a temporada é considerada integralmente validada dentro do conjunto de partidas efetivamente disputadas.

## Normalização dos clubes

A validação histórica também revelou diversas representações diferentes para os mesmos clubes.

Exemplos encontrados incluem:

Nautico
Náutico

America-RN
América-RN

Sport Recife
Sport

Vasco da Gama RJ
Vasco da Gama

Além de erros presentes nas próprias fontes, como:

C ruzeiro
Fl amengo
G oiás
S antos
Santo s
Palmeira
Joinvile

Essas representações são normalizadas através de:

data/mappings/team-aliases.json

Os erros encontrados nas fontes são aceitos somente como aliases de entrada e nunca utilizados como nomes canônicos das equipes.

## Escopo da validação concluída

O estado VALIDATED desta etapa significa que os resultados das partidas foram reconciliados entre as fontes disponíveis, considerando:

- normalização dos nomes dos clubes;
- partidas anuladas;
- resultados administrativos;
- correções conhecidas de placar nas fontes;
- partidas adiadas ou associadas a rodadas diferentes;
- confrontos repetidos;
- variações de nomenclatura;
- particularidades históricas da competição.

A validação dos resultados não implica que todos os demais campos possuam cobertura equivalente.

Elementos como:

- posse de bola;
- finalizações;
- cartões;
- eventos individuais de gol;
- jogadores;
- escalações;

continuam sujeitos às suas próprias auditorias de cobertura e qualidade.

## Estado final desta etapa

A camada histórica de resultados entre:

2003 → 2024

foi considerada validada para continuidade do pipeline de normalização e persistência.

Nenhum dado ausente foi inventado.

Nenhum arquivo raw foi alterado para forçar concordância entre as fontes.

As diferenças conhecidas permanecem explicitamente registradas como parte da proveniência dos dados.