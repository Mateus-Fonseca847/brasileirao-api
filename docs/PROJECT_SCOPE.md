# Escopo do Projeto — API do Brasileirão

## 1. Visão geral

A API do Brasileirão é uma API REST voltada para disponibilização de dados históricos e atuais do Campeonato Brasileiro Série A.

O projeto tem como objetivo organizar informações do campeonato em uma base estruturada, consultável e documentada, permitindo que desenvolvedores, estudantes, pesquisadores e aplicações externas utilizem os dados do Brasileirão de maneira simples.

A cobertura histórica do projeto começa em 2003, início da era dos pontos corridos, e segue até a temporada atual.

---

## 2. Período de cobertura

A API deverá contemplar as temporadas:

```text
2003 → temporada atual
```

Temporadas encerradas serão consideradas dados históricos.

A temporada atualmente em disputa será identificada separadamente como uma temporada em andamento.

Exemplo:

```text
2025 → finished
2026 → in_progress
```

Quando uma temporada for concluída e validada, seu status será alterado para:

```text
finished
```

---

## 3. Dados disponibilizados

A API deverá disponibilizar os seguintes grupos de informações.

### 3.1 Temporadas

Para cada temporada serão armazenadas informações como:

* ano;
* status;
* período de realização;
* quantidade de clubes participantes.

---

## 3.2 Classificação

A API deverá disponibilizar a classificação da Série A em cada temporada.

Os dados previstos são:

* posição;
* clube;
* pontos;
* jogos;
* vitórias;
* empates;
* derrotas;
* gols marcados;
* gols sofridos;
* saldo de gols.

---

## 3.3 Partidas

Cada partida deverá conter, quando disponível:

* temporada;
* rodada;
* data;
* horário;
* equipe mandante;
* equipe visitante;
* gols do mandante;
* gols do visitante;
* estádio;
* status da partida.

---

## 3.4 Estatísticas por equipe

As estatísticas de cada partida serão associadas individualmente às equipes participantes.

Uma partida deverá possuir um conjunto de estatísticas para cada clube.

Exemplo:

```text
Flamengo x Palmeiras

Flamengo:
- gols
- chutes
- posse
- cartões

Palmeiras:
- gols
- chutes
- posse
- cartões
```

As estatísticas inicialmente previstas são:

* gols;
* chutes;
* posse de bola;
* cartões amarelos;
* cartões vermelhos.

Outras estatísticas poderão ser adicionadas futuramente.

---

## 3.5 Gols marcados e sofridos

A API deverá permitir identificar, por equipe e por temporada:

* gols marcados;
* gols sofridos;
* saldo de gols.

Essas informações deverão ser derivadas dos resultados das partidas sempre que possível.

---

## 3.6 Jogadores e artilharia

A API deverá disponibilizar:

* jogadores;
* quantidade de gols;
* equipe representada;
* artilharia de cada temporada.

Quando houver informações suficientes, gols individuais poderão ser associados diretamente à partida em que aconteceram.

---

## 4. Tratamento de dados históricos incompletos

Nem todas as estatísticas possuem o mesmo nível de disponibilidade histórica.

Resultados e classificações possuem maior cobertura histórica do que estatísticas como:

* posse de bola;
* número de chutes;
* cartões detalhados;
* eventos individuais de jogadores.

Quando uma informação não puder ser confirmada através de uma fonte confiável, ela não será estimada ou inventada.

Exemplo:

```text
possession: null
```

significa que a estatística não foi encontrada ou não pôde ser confirmada.

Isso é diferente de:

```text
possession: 0
```

que representaria um valor real igual a zero.

---

## 5. Confiabilidade dos dados

Os dados deverão possuir uma origem rastreável.

Sempre que possível, registros serão comparados com mais de uma fonte.

Os dados poderão receber indicadores de qualidade como:

```text
verified
complete
partial
unavailable
provisional
```

### verified

Informação validada através de fontes independentes.

### complete

A fonte possui cobertura considerada completa para aquele conjunto de dados.

### partial

Apenas parte das informações está disponível.

### unavailable

A informação não foi encontrada em uma fonte adequada.

### provisional

Informação relacionada a uma temporada ainda em andamento.

---

## 6. Uso de inteligência artificial

Inteligência artificial poderá ser utilizada como ferramenta auxiliar durante o desenvolvimento.

Exemplos:

* análise de inconsistências;
* identificação de possíveis duplicidades;
* apoio na normalização;
* geração e revisão de documentação;
* criação e revisão de testes;
* auxílio na análise dos dados.

A inteligência artificial não será utilizada como fonte para gerar estatísticas históricas inexistentes.

Todo dado esportivo publicado pela API deverá possuir uma fonte identificável.

---

## 7. Arquitetura geral dos dados

Os dados seguirão um fluxo de processamento.

```text
Fonte externa
     ↓
Dados brutos
     ↓
Normalização
     ↓
Validação
     ↓
Banco de dados
     ↓
API REST
```

A API não deverá depender de consultas em tempo real a sites externos para responder aos usuários.

Os dados serão previamente coletados, processados e armazenados.

---

## 8. Temporadas históricas

Depois que uma temporada encerrada tiver seus dados importados e validados, ela deverá ser tratada como histórica.

Alterações nesses dados deverão ocorrer apenas através de processos controlados de correção.

O objetivo é evitar que dados históricos sejam modificados acidentalmente.

---

## 9. Temporada atual

A temporada em andamento poderá receber atualizações.

Enquanto estiver ocorrendo:

```text
status = in_progress
```

Após o encerramento:

```text
in_progress
↓
validation
↓
finished
```

A classificação da temporada atual deverá ser considerada provisória até o encerramento oficial da competição.

---

## 10. Público-alvo

A API poderá ser utilizada por:

* estudantes;
* desenvolvedores;
* pesquisadores;
* projetos de análise de dados;
* aplicações esportivas;
* dashboards;
* projetos acadêmicos;
* modelos de machine learning;
* projetos pessoais.

---

## 11. Objetivos técnicos

O projeto deverá possuir:

* API REST;
* banco de dados relacional;
* documentação OpenAPI;
* validação dos dados;
* testes automatizados;
* versionamento com Git;
* documentação das fontes;
* documentação da arquitetura;
* histórico de alterações.

---

## 12. Fora do escopo inicial

A primeira versão do projeto não pretende possuir:

* sistema de usuários;
* login;
* painel administrativo;
* pagamentos;
* inteligência artificial integrada à API;
* microserviços;
* GraphQL;
* sistema complexo de permissões;
* processamento distribuído.

Esses recursos somente deverão ser considerados caso surja uma necessidade real no futuro.

---

## 13. Critério de sucesso

O projeto será considerado funcional quando um consumidor externo conseguir:

1. consultar as temporadas disponíveis;
2. consultar a classificação de determinada temporada;
3. consultar os clubes participantes;
4. consultar as partidas;
5. visualizar os resultados;
6. consultar estatísticas separadas por equipe;
7. consultar gols marcados e sofridos;
8. consultar os artilheiros da temporada;
9. identificar quando uma informação histórica não estiver disponível;
10. compreender a origem e o nível de confiabilidade dos dados através da documentação.
