# Brasileirão API

API REST em TypeScript para consulta de dados históricos validados do Campeonato Brasileiro Série A na era dos pontos corridos.

## Propósito

O projeto organiza dados históricos do Brasileirão Série A em uma base PostgreSQL normalizada, com API HTTP documentada por OpenAPI. A versão atual cobre temporadas encerradas de 2003 a 2024 e prioriza dados rastreáveis, normalizados e validados antes da exposição pública.

## Escopo da API v1

A v1 inclui:

- temporadas;
- equipes canônicas;
- participação de equipes por temporada;
- partidas oficiais;
- placares oficiais e placares em campo;
- estatísticas agregadas por equipe em partida;
- cartões amarelos e vermelhos agregados por equipe;
- classificações oficiais finais;
- ajustes administrativos de pontuação na classificação.

A v1 não inclui:

- jogadores;
- estatísticas de jogadores;
- transferências;
- eventos de gol como recursos públicos;
- eventos de cartão como recursos públicos.

Recursos relacionados a jogadores estão planejados para a v2.

## Stack

- Node.js com ESM e TypeScript NodeNext
- Fastify 5
- Zod para validação HTTP
- Prisma 7
- PostgreSQL
- Vitest
- OpenAPI e Swagger UI
- Docker e Docker Compose

## Arquitetura

Fluxo de dados:

```text
data/raw -> scripts de auditoria/normalização -> data/normalized -> PostgreSQL -> API REST
```

Estrutura principal:

```text
src/
  app.ts                    # criação da aplicação Fastify
  server.ts                 # startup HTTP e shutdown
  config/                   # configuração de ambiente
  database/                 # Prisma compartilhado
  http/                     # erros, validação, segurança e OpenAPI
  modules/                  # módulos HTTP por domínio
scripts/
  audit/                    # auditorias de fontes
  database/                 # importadores idempotentes
  normalization/            # geração de datasets normalizados
  parsers/                  # parsers reutilizáveis
data/
  raw/                      # fontes brutas
  mappings/                 # mapeamentos e correções documentadas
  normalized/               # datasets normalizados
  audit/                    # relatórios de auditoria
prisma/
  schema.prisma
  migrations/
tests/
  http/
```

## Cobertura Histórica

A base v1 cobre temporadas de 2003 a 2024.

Dados disponíveis:

- temporadas: 2003-2024;
- equipes canônicas: 44;
- partidas oficiais: 2003-2024;
- participantes por temporada: 2003-2024;
- classificações finais oficiais: 2003-2024;
- estatísticas de chutes e posse: cobertura parcial validada entre 2014 e 2023;
- cartões agregados: 2014-2024.

Regra de dados: estatísticas indisponíveis são representadas como `null`, nunca como `0`. O valor `0` é usado apenas quando o zero real foi validado.

## Fontes e Validação

Principais fontes atualmente documentadas:

- Adão Duque: partidas, estatísticas e cartões;
- OpenFootball: fonte auxiliar e comparação histórica;
- Ricardo M. Czekster / BCAS: classificações finais;
- CBF e fontes externas pontuais: validação de casos específicos.

Os scripts de auditoria comparam fontes, validam nomes de equipes por aliases canônicos, aplicam correções documentadas e impedem normalização/importação quando há inconsistências não resolvidas.

## Endpoints

Documentação interativa:

```text
GET /docs
```

Documento OpenAPI:

```text
GET /docs/json
```

Rotas públicas:

```text
GET /health
GET /seasons
GET /seasons/:year
GET /seasons/:year/teams
GET /seasons/:year/standings
GET /teams
GET /teams/:slug
GET /matches
GET /matches/:id
GET /matches/:id/stats
```

## Partidas

`GET /matches` aceita filtros combináveis:

- `season`: ano inteiro maior ou igual a 2003;
- `team`: slug canônico em kebab-case;
- `round`: rodada como inteiro positivo.

Paginação:

- `page`: inteiro positivo, padrão `1`;
- `limit`: inteiro positivo, padrão `50`, máximo `100`.

Exemplo:

```bash
curl "http://localhost:3000/matches?season=2024&team=flamengo&limit=10&page=2"
```

Formato da resposta:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 0,
    "totalPages": 0
  }
}
```

## Ambiente

Variáveis principais:

```text
DATABASE_URL=postgresql://brasileirao:change_me@127.0.0.1:5432/brasileirao?schema=public
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
RATE_LIMIT_MAX=100
```

Use `.env.example` como referência. Não coloque segredos reais no repositório.

`CORS_ORIGIN=*` permite consumo público por qualquer frontend e é adequado para a versão pública da API v1, que é somente leitura, sem autenticação, cookies ou sessão. Ambientes restritos podem informar múltiplas origens específicas separadas por vírgulas, por exemplo `CORS_ORIGIN=https://site-a.com,https://site-b.com`.

A API não habilita `credentials: true` no CORS. `RATE_LIMIT_MAX` define o limite global de requisições por janela e mantém uma proteção básica contra abuso.

## Desenvolvimento Local

Instale as dependências:

```bash
npm install
```

Suba o PostgreSQL local:

```bash
docker compose up -d
```

Verifique o container:

```bash
docker compose ps
```

Verifique a conexão com o banco:

```bash
npm run db:check
```

Gere o Prisma Client quando necessário:

```bash
npx prisma generate
```

Inicie a API em desenvolvimento:

```bash
npm run dev
```

A API usa `PORT` e `HOST` do ambiente. Com os valores padrão, acesse:

```text
http://localhost:3000
```

## Importação de Dados

Os importadores são idempotentes e usam os datasets normalizados versionados:

```bash
npm run db:import:seasons
npm run db:import:teams
npm run db:import:season-teams
npm run db:import:matches
npm run db:import:match-team-stats
npm run db:import:match-team-cards
npm run db:import:standings
```

## Comandos de Desenvolvimento

```bash
npx tsc --noEmit
npm run build
npm test
```

Auditorias e normalizações disponíveis:

```bash
npm run audit:adaoduque
npm run audit:adaoduque-cards
npm run audit:czekster-standings
npm run audit:historical-range
npm run audit:team-aliases-range
npm run audit:validation-summary
npm run normalize:standings
npm run normalize:match-team-cards
```

## Build de Produção

Compile o TypeScript:

```bash
npm run build
```

Execute a aplicação compilada:

```bash
npm start
```

## Docker

Crie a imagem de produção:

```bash
docker build -t brasileirao-api .
```

A imagem:

- usa build multi-stage;
- instala dependências de produção no estágio final;
- gera o Prisma Client durante o build;
- compila TypeScript;
- executa `npm start`;
- roda como usuário não-root `node`;
- não copia `.env` para a imagem.

Exemplo de execução:

```bash
docker run --rm -p 3000:3000 --env-file .env brasileirao-api
```

O PostgreSQL local do projeto é definido em `compose.yaml` e permanece separado da imagem da API.

## Produção

A API v1 está publicada em produção com aplicação containerizada em Docker e deploy no Northflank. O CI/CD está conectado à branch `main`, e o serviço Fastify expõe a porta `3000`.

O PostgreSQL de produção roda em rede privada no Northflank. A `DATABASE_URL` é injetada em runtime por Secret Group, sem versionar credenciais, tokens ou strings reais de conexão.

A readiness probe usa:

```text
GET /health
```

A rota `/health` valida tanto a aplicação quanto a conexão com o PostgreSQL. Em produção pública, o CORS pode ser configurado com `CORS_ORIGIN=*` e o rate limit padrão recomendado é `RATE_LIMIT_MAX=100`.

URL pública:

```text
A definir
```

## Limitações Conhecidas

- A v1 expõe estatísticas agregadas, não eventos individuais.
- Estatísticas de chutes e posse têm cobertura histórica parcial.
- Eventos de cartões e gols são usados em auditorias/datasets internos, mas não são recursos públicos da v1.
- Temporadas futuras ou em andamento não fazem parte da base histórica validada 2003-2024.

## Roadmap v2

Recursos planejados para v2:

- jogadores;
- estatísticas de jogadores;
- transferências;
- artilharia;
- eventos de gol;
- eventos de cartão como recurso público, quando houver validação suficiente.
