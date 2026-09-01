# Guia de Contribuição

Este documento descreve o fluxo de contribuição e integração adotado após a v1.0.0 da API.

## Branches

Novas alterações devem preferencialmente partir de uma branch criada a partir de `main`.

Prefixos recomendados:

- `feat/`
- `fix/`
- `docs/`
- `chore/`
- `ci/`
- `refactor/`
- `test/`

Não usamos Git Flow complexo. Não crie branches permanentes como `develop` ou `release`. A branch `main` continua sendo a branch de produção.

## Pull Requests

Fluxo esperado:

```text
main atualizada
↓
criação de branch
↓
implementação
↓
testes locais
↓
commits organizados
↓
push da branch
↓
Pull Request
↓
CI obrigatório
↓
merge em main
```

O Northflank está conectado à branch `main`. Portanto, merge em `main` pode produzir deployment.

## Validações Locais

Antes de abrir um Pull Request, execute:

```bash
npx tsc --noEmit
npm test
npm run build
git diff --check
```

## Commits

Use Conventional Commits.

Tipos principais:

- `feat`: nova funcionalidade.
- `fix`: correção de bug.
- `docs`: documentação.
- `test`: testes.
- `refactor`: refatoração sem mudança de comportamento.
- `ci`: integração contínua.
- `build`: build, empacotamento ou dependências de build.
- `chore`: manutenção sem impacto funcional direto.

Exemplos:

```text
feat: add season standings endpoint
fix: preserve null values in match stats
docs: document production deployment
test: add match pagination coverage
ci: add automated quality checks
chore: align package metadata with v1.0.0
```

## Segredos

Nunca versione:

- `.env`
- `DATABASE_URL` real
- senhas
- tokens do Northflank
- credenciais PostgreSQL
- outros secrets

Use variáveis de ambiente, secrets do provedor de CI/CD ou Secret Groups do Northflank.

## Escopo de PR

Mantenha o Pull Request focado:

- uma alteração lógica por PR sempre que possível;
- commits separados por responsabilidade;
- sem refactors não relacionados;
- documentação acompanhando mudanças de contrato quando necessário.
