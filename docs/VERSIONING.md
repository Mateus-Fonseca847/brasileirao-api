# Política de Versionamento

Esta política define como a Brasileirão API deve ser versionada após a publicação da `v1.0.0`.

## Semantic Versioning

Releases públicas seguem Semantic Versioning:

```text
MAJOR.MINOR.PATCH
```

## PATCH

Use PATCH para correções compatíveis, sem alteração incompatível no contrato público da API.

Exemplo:

```text
1.0.0 -> 1.0.1
```

## MINOR

Use MINOR para novas funcionalidades retrocompatíveis.

Exemplo: novos endpoints de jogadores sem quebrar endpoints existentes.

```text
1.0.0 -> 1.1.0
```

## MAJOR

Use MAJOR para mudanças incompatíveis de contrato.

Exemplo: alteração obrigatória no formato de respostas existentes.

```text
1.x -> 2.0.0
```

## Roadmap vs Release

`v2` pode ser usado informalmente como nome de uma fase do roadmap, mas isso não significa obrigatoriamente uma release SemVer `2.0.0`.

Por exemplo, o roadmap de jogadores pode ser chamado de fase v2. Se os endpoints e campos forem adicionados sem quebrar contratos existentes, a release técnica pode ser:

```text
v1.1.0
```

## Compatibilidade na Linha 1.x

Durante a linha `1.x`:

- endpoints existentes não devem ser removidos sem processo de depreciação;
- campos obrigatórios existentes não devem mudar de significado;
- novos campos opcionais podem ser adicionados;
- novos endpoints podem ser adicionados;
- filtros adicionais compatíveis podem ser adicionados.

## Breaking Changes

Exemplos de breaking changes:

- remover endpoint;
- renomear campo existente;
- mudar tipo de um campo;
- alterar estrutura fundamental da resposta;
- alterar semântica documentada.

Essas mudanças devem exigir uma major release ou uma estratégia explícita de versionamento de API.

Não há implementação de rotas `/v1` ou `/v2` nesta política.

## Processo de Release

Checklist recomendado:

1. `main` estável;
2. CI verde;
3. working tree limpa;
4. versão de metadata sincronizada quando aplicável;
5. testes executados;
6. build executado;
7. documentação atualizada;
8. tag anotada criada;
9. push da tag;
10. GitHub Release publicada;
11. validação de produção.

## Tags

Use tags no padrão:

```text
v1.0.0
v1.0.1
v1.1.0
v2.0.0
```
