# Database Recovery Runbook

Este runbook descreve backup, reconstrução e recuperação do PostgreSQL de produção da Brasileirão API.

Não registre senhas, `DATABASE_URL` real, tokens, hosts privados completos ou outros secrets neste documento.

## Escopo

O banco da API v1 contém dados históricos derivados de artefatos versionados no repositório:

- `prisma/migrations/`
- `data/normalized/`
- `scripts/database/`

Esses artefatos permitem reconstruir deterministicamente a base histórica conhecida, mas não substituem um backup real do PostgreSQL.

## Backup vs Reconstrução

### Backup

Backup é um snapshot ou dump real do PostgreSQL em um ponto no tempo. Ele preserva o estado efetivo do banco, incluindo metadados operacionais, timestamps gerados, extensões, configurações e qualquer dado válido que ainda não exista como dataset versionado.

Backups devem ser a opção preferencial para recuperação operacional quando estiverem configurados e verificados.

### Reconstrução

Reconstrução é recriar o banco a partir de:

```text
Prisma migrations
+
datasets normalizados
+
importadores idempotentes
```

A reconstrução é útil quando a base pode ser refeita a partir dos dados históricos versionados. Ela não deve ser tratada como substituto perfeito de backup.

## Partes Reconstruíveis pelo Repositório

O repositório consegue reconstruir:

- schema relacional via Prisma migrations;
- temporadas;
- equipes canônicas;
- participação de equipes por temporada;
- partidas;
- estatísticas de chutes e posse por equipe em partida;
- cartões amarelos e vermelhos agregados por equipe em partida;
- classificações finais.

## Procedimento de Reconstrução

Use um ambiente com `DATABASE_URL` apontando para o PostgreSQL alvo. Não exponha o valor real da variável em logs, issues ou documentação.

Instale dependências:

```bash
npm ci
```

Gere o Prisma Client:

```bash
npx prisma generate --config prisma7.config.ts
```

Aplique migrations:

```bash
npx prisma migrate deploy --config prisma7.config.ts
```

Carregue os datasets normalizados na ordem abaixo:

```bash
npm run db:import:seasons
npm run db:import:teams
npm run db:import:season-teams
npm run db:import:matches
npm run db:import:match-team-stats
npm run db:import:match-team-cards
npm run db:import:standings
```

Ordem conceitual:

```text
Prisma migrations
↓
seasons
↓
teams
↓
season-teams
↓
matches
↓
match-team-stats
↓
match-team-cards
↓
standings
```

## Verificação Após Recuperação

Verifique a conexão com o banco:

```bash
npm run db:check
```

Execute smoke tests HTTP da API:

```bash
curl -i "$API_BASE_URL/health"
curl -i "$API_BASE_URL/seasons"
curl -i "$API_BASE_URL/teams"
curl -i "$API_BASE_URL/seasons/2024/standings"
curl -i "$API_BASE_URL/matches?season=2024&limit=10"
```

`GET /health` deve validar a aplicação e a conexão com o PostgreSQL.

## Production Backup Policy

Status atual: `Configured and verified in Northflank`.

Configuração atual de produção:

- backup automático configurado: sim;
- tipo de backup automático: snapshot;
- frequência: semanal;
- execução: segunda-feira às 06:00 UTC (03:00 em UTC-3);
- retenção: 60 dias;
- backup manual verificado: sim;
- último backup manual de verificação: `manual-pre-v2-check`, concluído com sucesso em 2026-09-01;
- procedimento de restore testado: não;
- data do último teste de restore: ainda não realizado.

A criação de um backup manual foi validada diretamente no PostgreSQL de produção do Northflank. Isso confirma o funcionamento do mecanismo de criação de snapshots, mas não valida o processo completo de restauração.

Um restore deve ser testado futuramente em um ambiente não produtivo antes de ser considerado validado operacionalmente.

Antes de migrations, importações extensas ou alterações estruturais relevantes no banco, considere criar também um backup manual adicional.


## Procedimento de Incidente

1. Interromper alterações, imports ou jobs que possam escrever no banco.
2. Identificar o incidente e o escopo dos dados afetados.
3. Escolher entre restore de backup ou reconstrução por migrations e datasets.
4. Validar integridade básica do banco recuperado.
5. Executar smoke tests da API.
6. Reativar tráfego quando a API estiver saudável.
7. Documentar o incidente, causa provável, ação tomada e pendências.

## Segurança

Nunca documente ou versione:

- senhas;
- `DATABASE_URL` real;
- tokens;
- host privado completo quando desnecessário;
- secrets de CI/CD ou Northflank;
- credenciais PostgreSQL.

Use apenas placeholders e referências conceituais.
