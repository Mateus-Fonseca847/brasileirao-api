# Fontes de Dados — API do Brasileirão

## 1. Objetivo

Este documento registra as fontes avaliadas para construção da base histórica da API do Brasileirão.

O objetivo é determinar:

* quais dados cada fonte disponibiliza;
* quais temporadas são cobertas;
* quais fontes podem ser utilizadas para ingestão;
* quais fontes serão utilizadas apenas para validação;
* quais limitações técnicas existem;
* quais limitações de licença ou redistribuição existem;
* quais conjuntos de dados ainda precisam ser auditados.

Nenhum dado deverá ser incorporado definitivamente à API sem que sua origem seja conhecida.

---

# 2. Categorias de fontes

As fontes serão classificadas em três categorias.

## 2.1 Fonte de ingestão

Fonte cujos dados podem ser utilizados para alimentar o banco de dados da aplicação.

A utilização depende de:

* licença compatível;
* cobertura suficiente;
* estrutura adequada;
* possibilidade de rastrear a origem dos dados.

---

## 2.2 Fonte de validação

Fonte utilizada para comparar dados obtidos através de outra fonte.

Ela poderá ser utilizada para verificar:

* resultados;
* classificação;
* pontuação;
* quantidade de partidas;
* gols marcados;
* gols sofridos;
* participantes da temporada.

---

## 2.3 Fonte oficial de referência

Fonte oficial utilizada para conferência humana ou resolução de divergências.

Uma fonte oficial não será automaticamente considerada uma fonte autorizada para coleta e redistribuição.

---

# 3. Status das fontes

Cada fonte analisada receberá um dos seguintes estados.

```text
approved
candidate
validation_only
reference_only
rejected
pending
```

### approved

Fonte autorizada para utilização no pipeline de dados.

### candidate

Fonte tecnicamente interessante, mas que ainda necessita de auditoria.

### validation_only

Fonte utilizada principalmente para comparação e validação.

### reference_only

Fonte utilizada apenas como referência.

### rejected

Fonte que não deverá ser utilizada no processo de ingestão.

### pending

Fonte cuja utilização ainda não foi decidida.

---

# 4. OpenFootball

## Identificação

```text
source_id: openfootball
type: open_data
status: approved
```

## Finalidade

O OpenFootball será considerado uma das principais fontes para:

* temporadas;
* partidas;
* rodadas;
* datas;
* clubes;
* resultados.

## Licença

Os datasets do projeto são disponibilizados sob CC0 / domínio público.

Isso torna a fonte particularmente interessante para um projeto que pretende redistribuir informações através de uma API pública.

## Uso planejado

```text
OpenFootball
      ↓
Resultados históricos
      ↓
Normalização
      ↓
Validação
      ↓
Banco de dados
```

## Papel no projeto

Será uma fonte preferencial para informações básicas das partidas quando houver cobertura adequada.

## Limitações

A fonte não será considerada suficiente, por si só, para estatísticas avançadas como:

* posse de bola;
* finalizações;
* cartões detalhados;
* artilharia completa.

Esses dados dependerão de outras fontes.

---

# 5. Dataset de Ricardo Czekster

## Identificação

```text
source_id: rczekster_brasileirao
type: dataset
status: validation_only
```

## Cobertura conhecida

```text
2003 → 2024
```

## Dados disponíveis

O dataset contém principalmente:

* partidas;
* resultados;
* temporadas;
* classificação final;
* participantes.

## Característica importante

O autor informa que os resultados das partidas foram validados de forma que reproduzam a classificação final de cada temporada.

Por esse motivo, o dataset será especialmente útil para validação cruzada.

## Licença

```text
CC BY 4.0
```

A utilização exige atribuição adequada à fonte.

## Uso planejado

Exemplo:

```text
Resultado importado
        ↓
Comparação
        ↓
Dataset Ricardo Czekster
        ↓
Coincide?
   ↓            ↓
 sim           não
 ↓              ↓
verified     revisão
```

## Papel no projeto

Não será inicialmente a fonte principal.

Sua função principal será verificar:

* placares;
* quantidade de jogos;
* participantes;
* classificação final;
* pontuação das equipes.

---

# 6. Dataset de Adão Duque

## Identificação

```text
source_id: adaoduque_brasileirao
type: dataset
status: candidate
```

## Cobertura conhecida

O dataset informa cobertura de partidas entre:

```text
2003 → 2024
```

## Arquivos relevantes

A estrutura disponibilizada inclui arquivos equivalentes a:

```text
partidas
estatísticas
gols
cartões
```

Os dados encontrados incluem campos relacionados a:

### Partidas

* rodada;
* data;
* horário;
* mandante;
* visitante;
* placar;
* estádio.

### Estatísticas

* clube;
* chutes;
* chutes ao gol;
* posse de bola;
* passes;
* precisão de passes;
* faltas;
* cartões amarelos;
* cartões vermelhos;
* impedimentos;
* escanteios.

### Gols

* partida;
* clube;
* atleta;
* minuto.

### Cartões

* partida;
* clube;
* atleta;
* tipo de cartão;
* minuto.

## Licença informada

A página do dataset atualmente indica:

```text
GPL 2
```

Essa informação deverá ser revisada antes de qualquer redistribuição direta dos arquivos.

## Limitação de proveniência

O próprio projeto informa que os dados foram coletados a partir de páginas apresentadas pelo Google.

Por isso, apesar de o dataset ser extremamente útil tecnicamente, ele não será automaticamente considerado nossa fonte definitiva.

Antes disso serão auditados:

* cobertura por temporada;
* quantidade de registros;
* valores ausentes;
* consistência das estatísticas;
* licença;
* proveniência.

## Papel planejado

O dataset é atualmente o principal candidato para obtenção de:

```text
chutes
posse
gols individuais
cartões
```

mas sua utilização definitiva dependerá da auditoria.

---

# 7. Confederação Brasileira de Futebol — CBF

## Identificação

```text
source_id: cbf
type: official
status: reference_only
```

## Dados relevantes encontrados

A CBF disponibiliza publicamente informações como:

* classificação;
* pontos;
* jogos;
* vitórias;
* empates;
* derrotas;
* gols pró;
* gols contra;
* saldo de gols;
* cartões;
* tabelas;
* documentos oficiais da competição.

## Papel no projeto

A CBF será utilizada como:

```text
fonte oficial de referência
```

principalmente para:

* confirmar classificação;
* verificar temporadas;
* verificar regulamentos;
* investigar divergências;
* validar informações importantes.

## Restrição

Os termos de utilização da CBF estabelecem restrições relacionadas à cópia, reprodução e redistribuição do conteúdo de seus sites.

Por esse motivo:

```text
CBF != fonte automática de ingestão
```

A API não deverá realizar scraping do site da CBF nem utilizar seu conteúdo como uma base redistribuída sem autorização apropriada.

---

# 8. Sofascore

## Identificação

```text
source_id: sofascore
type: third_party_platform
status: rejected
```

## Motivo da avaliação

O Sofascore possui dados esportivos detalhados e poderia, tecnicamente, fornecer grande parte das estatísticas desejadas.

Entretanto, seus termos restringem:

* scraping;
* extração automatizada;
* reprodução;
* disponibilização pública de conteúdo da base;
* utilização automatizada sem autorização.

## Decisão

O Sofascore não será utilizado como fonte de ingestão da API.

```text
Sofascore
    ↓
NÃO utilizar no pipeline
```

Uma eventual utilização futura dependeria de autorização ou contrato específico.

---

# 9. Estratégia inicial de fontes

A arquitetura de dados deverá seguir inicialmente o seguinte modelo:

```text
              ┌─────────────────────┐
              │    OpenFootball     │
              │ resultados básicos  │
              └──────────┬──────────┘
                         │
                         ↓
                 Dados importados
                         │
                         ↓
              ┌─────────────────────┐
              │ Dataset de Ricardo  │
              │     validação       │
              └──────────┬──────────┘
                         │
                         ↓
                    comparação
                         │
                         ↓
              ┌─────────────────────┐
              │        CBF          │
              │ referência oficial │
              └─────────────────────┘
```

Para estatísticas avançadas:

```text
Dataset Adão Duque
        ↓
     auditoria
        ↓
licença + cobertura
        ↓
       aprovado?
      /         \
    sim         não
     ↓           ↓
 ingestão    nova fonte
```

---

# 10. Hierarquia de confiança

Quando ocorrer uma divergência entre fontes, não será feita correção automática.

A divergência deverá ser registrada e investigada.

A ordem conceitual será:

```text
Fonte de ingestão
       ↓
Validação independente
       ↓
Referência oficial
       ↓
Decisão documentada
```

A API não deverá ocultar conflitos entre fontes durante o processo de importação.

---

# 11. Cobertura histórica inicial

Legenda:

```text
AVAILABLE   = existe fonte identificada
AUDIT       = existe candidato, mas cobertura precisa ser conferida
PROVISIONAL = temporada ainda em andamento
```

| Temporada | Partidas    | Classificação | Artilharia | Gols individuais | Chutes | Posse | Cartões |
| --------- | ----------- | ------------- | ---------- | ---------------- | ------ | ----- | ------- |
| 2003      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2004      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2005      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2006      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2007      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2008      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2009      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2010      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2011      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2012      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2013      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2014      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2015      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2016      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2017      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2018      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2019      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2020      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2021      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2022      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2023      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2024      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2025      | AVAILABLE   | AVAILABLE     | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |
| 2026      | PROVISIONAL | PROVISIONAL   | AUDIT      | AUDIT            | AUDIT  | AUDIT | AUDIT   |

Essa tabela representa o estado da pesquisa, não a cobertura final da API.

Um campo marcado como `AUDIT` não significa ausência do dado.

Significa que a existência e a completude do dado ainda precisam ser verificadas através dos arquivos reais.

---

# 12. Temporada 2026

A temporada de 2026 exige tratamento separado.

Ela ainda está em andamento e seus registros poderão mudar a cada rodada.

Neste momento:

```text
2026.status = in_progress
```

A fonte definitiva responsável pelas atualizações da temporada atual ainda não foi aprovada.

O OpenFootball poderá ser utilizado caso seus dados estejam atualizados e disponíveis dentro da cobertura necessária.

Não será implementado um fallback utilizando scraping de plataformas cuja autorização de redistribuição não esteja estabelecida.

---

# 13. Política para dados ausentes

Uma estatística ausente nunca deverá ser substituída por uma estimativa.

Exemplo:

```text
shots = null
possession = null
```

significa:

```text
dado não disponível
```

e não:

```text
valor igual a zero
```

---

# 14. Política de validação

Antes de uma temporada ser considerada validada, deverão ser conferidos pelo menos:

* número de partidas;
* clubes participantes;
* placares;
* pontos;
* vitórias;
* empates;
* derrotas;
* gols marcados;
* gols sofridos;
* classificação.

Para estatísticas avançadas deverão ser verificadas:

* quantidade de partidas com estatísticas;
* quantidade de equipes por partida;
* quantidade de valores nulos;
* valores impossíveis;
* consistência entre as equipes.

---

# 15. Próxima auditoria

A próxima etapa do projeto deverá analisar fisicamente os datasets candidatos.

A primeira auditoria deverá responder:

### Dataset de partidas

```text
Quantas partidas existem em cada temporada?
```

### Dataset de estatísticas

```text
Quantas partidas possuem estatísticas por temporada?
```

### Dataset de gols

```text
Quantos jogos possuem eventos de gol registrados?
```

### Dataset de cartões

```text
Quantos jogos possuem cartões registrados?
```

Depois dessa análise, os valores `AUDIT` da matriz de cobertura poderão ser substituídos por estados reais como:

```text
COMPLETE
PARTIAL
UNAVAILABLE
```

---

# 16. Regra principal

A disponibilidade de uma informação na internet não significa automaticamente que ela poderá ser utilizada pela API.

Toda fonte deverá ser avaliada segundo três critérios:

```text
qualidade
+
cobertura
+
permissão de uso
```

Somente depois desses três critérios estarem satisfeitos o dado poderá entrar definitivamente no banco da aplicação.
