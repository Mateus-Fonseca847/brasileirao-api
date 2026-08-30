# Fonte — OpenFootball

## Identificação

source_id: openfootball

## Projeto

OpenFootball / football.db

Repositório utilizado para dados brasileiros:

openfootball/south-america

## Status

approved

## Licença

Os datasets, scripts e schema do OpenFootball são disponibilizados sob CC0 / domínio público.

Essa característica permite utilizar a fonte como uma das bases abertas do projeto.

## Utilização planejada

A fonte será utilizada principalmente para:

- temporadas;
- partidas;
- rodadas;
- equipes;
- resultados;
- validação independente de placares.

## Arquivos adquiridos

### Temporada 2024

Arquivo:

2024_br1.txt

Origem:

openfootball/south-america/brazil/2024_br1.txt

Finalidade:

auditoria e validação cruzada com o dataset de Adão Duque.

### Temporada 2025

Arquivo:

br.1.json

Origem:

openfootball/football.json/2025/br.1.json

Finalidade:

dados básicos da temporada 2025.

## Formatos

O projeto trabalha atualmente com dois formatos provenientes do ecossistema OpenFootball:

- Football.TXT
- JSON

O formato Football.TXT é considerado a fonte estrutural utilizada pelo projeto OpenFootball.

Os arquivos JSON são representações geradas a partir dos datasets estruturados.

## Regra de preservação

Todos os arquivos adquiridos nesta pasta pertencem à camada raw.

Portanto, não deverão ser modificados manualmente.

Qualquer processo de:

- normalização;
- correção;
- transformação;
- renomeação de equipes;

deverá acontecer posteriormente no pipeline.

## Cobertura auditada

A cobertura será registrada em:

docs/DATA_AUDIT.md

após a execução dos scripts de auditoria.