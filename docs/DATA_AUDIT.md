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
