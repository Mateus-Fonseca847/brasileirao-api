# Fonte — OpenFootball V0 Format

## Identificação

source_id: openfootball_v0

## Projeto

OpenFootball / v0-format

Repositório:

openfootball/v0-format

## Finalidade

Esta fonte será utilizada para auditoria e validação histórica dos resultados do Campeonato Brasileiro Série A em temporadas anteriores às disponíveis no formato atual do OpenFootball.

## Cobertura encontrada

O diretório brasileiro do repositório possui temporadas entre:

2003 → 2019

Para o projeto, a faixa prioritária será:

2003 → 2017

porque as temporadas entre 2018 e 2024 já estão sendo validadas através do repositório atual do OpenFootball.

## Arquivo por temporada

Cada temporada possui um diretório próprio.

O arquivo utilizado para a Série A segue o padrão:

brasileirao-seriea.txt

Exemplo:

openfootball/v0-format/brazil/2017/brasileirao-seriea.txt

## Licença

O repositório OpenFootball v0-format é disponibilizado sob licença CC0 1.0.

Os dados podem ser utilizados como dados abertos dentro do projeto.

## Formato

Os arquivos utilizam uma versão histórica do formato Football.TXT.

Exemplo conceitual:

Rodada 1

[Sáb, 13/Maio]

Flamengo 1 - 1 Atlético MG
Corinthians 1 - 1 Chapecoense

Esse formato é diferente do utilizado nos arquivos modernos do OpenFootball.

Por esse motivo, será mantido um parser específico para arquivos históricos.

## Arquivos locais

Os arquivos adquiridos serão armazenados seguindo o padrão:

data/raw/openfootball-v0/ANO_br1.txt

Exemplo:

data/raw/openfootball-v0/2017_br1.txt

## Regra de preservação

Todos os arquivos armazenados neste diretório pertencem à camada raw.

Eles não devem sofrer alterações manuais.

Qualquer processo de:

- interpretação;
- normalização;
- correção;
- associação de clubes;
- validação;

deverá acontecer através dos scripts do projeto.

## Status

validation_only

A fonte será inicialmente utilizada para validação cruzada dos resultados históricos existentes no dataset de Adão Duque.

Sua utilização como fonte principal de ingestão poderá ser avaliada posteriormente.