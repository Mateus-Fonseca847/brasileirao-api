# Dados Brutos

Este diretório armazena os arquivos originais obtidos das fontes externas utilizadas pelo projeto.

## Objetivo

Os dados armazenados em `raw/` representam a primeira camada do pipeline de dados da API do Brasileirão.

```text
Fonte
  ↓
raw
  ↓
normalização
  ↓
validação
  ↓
banco de dados
```

Os arquivos desta pasta devem ser preservados no formato em que foram obtidos.

## Regra de imutabilidade

Arquivos armazenados em `raw/` não devem ser:

* corrigidos manualmente;
* renomeados internamente;
* normalizados;
* filtrados;
* reordenados;
* complementados;
* utilizados para substituir valores ausentes manualmente.

Caso algum problema seja encontrado, a correção deverá acontecer em uma camada posterior do pipeline.

O dado original deve permanecer preservado.

## Organização

Cada fonte possui seu próprio diretório.

```text
raw/
├── openfootball/
└── adaoduque/
```

Dentro de cada diretório existe um arquivo `SOURCE.md` documentando:

* origem;
* finalidade;
* data de obtenção;
* licença conhecida;
* arquivos utilizados;
* observações relevantes.

## Versionamento

Os datasets brutos não serão inicialmente armazenados diretamente no Git.

O Git armazenará apenas a documentação necessária para reproduzir sua aquisição.

Essa decisão evita:

* duplicação desnecessária de datasets externos;
* aumento excessivo do tamanho do repositório;
* redistribuição acidental de arquivos de terceiros;
* perda da informação sobre a fonte original.

Os scripts de aquisição e processamento poderão ser adicionados posteriormente.
