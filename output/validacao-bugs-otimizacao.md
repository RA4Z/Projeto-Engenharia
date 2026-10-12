# Revisão de bugs e otimização — 12/10/2026

## Correções

- Arrastar um equipamento para um painel criado posteriormente ou alterar Localização podia colocar o filho antes do pai. A ordem é corrigida no modelo e protegida no adaptador do canvas.
- Selecionar/desmarcar um cabo pelo canvas podia conservar espessura e cor de rótulo da seleção anterior. A sincronização agora também verifica esses estilos.
- Alterações agrupadas do mesmo elemento podiam descartar a última posição/seleção quando ela coincidisse com o estado anterior ao lote. A ordem das alterações é preservada, sem criar atualizações para lotes inteiramente redundantes.
- A busca escondia os cabos. Agora encontra nomes e seções, tolera espaços nas extremidades e abre a lista de cabos ao pesquisar. Uma busca composta só de espaços mantém a hierarquia sem duplicar filhos.
- Clicar num cabo na árvore ou num aviso abria propriedades, mas não localizava o desenho. O enquadramento usa suas duas extremidades.
- A restauração inicial da câmera podia sobrescrever um enquadramento solicitado logo após abrir o projeto. Solicitações antecipadas aguardam a inicialização e prevalecem sobre a vista salva, sem passar para outro projeto.
- A importação verifica novamente o limite de 100 projetos depois de ler o arquivo, cobrindo criação de projetos durante uma leitura pendente.

## Desempenho

- Validação de topologia por índices, com percurso linear do grafo e detecção de ciclos inclusive em componentes isolados. A verificação de uma nova conexão também usa adjacências, sem varrer todos os cabos em cada visita.
- Cache de análise evita refazer cálculos e resultados de todos os nós após mudanças exclusivamente de posição, câmera ou metadados do projeto. Dados elétricos, conexões, hierarquia e nomes permanecem sincronizados.
- Atualizações sem alterações mantêm referências e não entram no histórico. Editar um nó preserva a lista de cabos; editar um cabo preserva a lista de nós.
- Árvore indexada por painel, com busca memorizada, evitando procurar filhos entre todos os equipamentos para cada linha.
- Acima de 200 equipamentos, o canvas desenha apenas elementos visíveis. Os símbolos têm dimensões conhecidas e geometria das portas para manter conexões e enquadramento de equipamentos ainda fora da tela. O modelo e as exportações conservam todos os elementos.

Referências da biblioteca: [elementos visíveis](https://reactflow.dev/api-reference/react-flow#viewport-props), [dimensões e portas declaradas](https://reactflow.dev/learn/advanced-use/ssr-ssg-configuration).

### Medições locais

Mesmo cenário de validação: 800 equipamentos numa cadeia com cabos em ordem inversa. Antes: **3.376 ms**; depois: **32 ms**. São medições pontuais da validação, sem incluir montagem da interface ou leitura de disco.

Uma cadeia de 1.900 equipamentos também foi validada por testes automatizados e importada no navegador. Em uma vista do projeto, os equipamentos montados no canvas caíram de **1.900 para 83**, mantendo 1.900 equipamentos e 1.899 conexões no modelo. O número desenhado varia com a câmera; localizar o último cabo enquadrou sua região e manteve o cabo selecionado visível.

## Validação

- `npm test`: **64 testes aprovados**, incluindo 14 novas regressões. Casos de React StrictMode cobrem o cache e pedidos de enquadramento antes da inicialização.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado, com exportação estática e cálculos exclusivamente no frontend.
- Três regressões de agrupamento/seleção foram reproduzidas com testes que falhavam antes das correções.

### Navegador integrado, build estático, origem de teste isolada

| Cenário                                             | Resultado                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Carga criada antes de painel → arrastar para dentro | Pai antes do filho; agrupamento correto, sem avisos de execução                            |
| Localização: painel → área de trabalho → painel     | Coordenadas e hierarquia válidas; desfazer/refazer funcionam                               |
| Motor: 45 → 60 kW, desfazer/refazer, mover com seta | Demanda 84,8 → 101,1 kW; resultados e avisos atualizados; mover preserva valores elétricos |
| JSON com referência inexistente                     | Erro em português; projeto atual preservado                                                |
| Importar 1.900 equipamentos e 1.899 cabos           | Grafo consistente e salvo neste navegador                                                  |
| Exportar JSON grande e conferir arquivo real        | Nós e cabos iguais aos do arquivo original validado                                        |
| Reimportar esse JSON                                | Nova cópia do projeto, com todos os elementos                                              |
| Buscar `C1899` e clicar imediatamente após abrir    | Último cabo localizado fora da vista inicial, após inicialização                           |
| Buscar `C-01` ou somente espaços                    | Cabo encontrado; hierarquia de 11 equipamentos sem duplicação                              |
| Seleção de cabo                                     | Espessura de 2,4 px; resultados e propriedades correspondentes                             |
| Seção de cabo inválida, 0 mm²                       | Valor anterior 50 mm² preservado e erro de intervalo exibido                               |
| Tour completo em 360 × 780                          | Dez passos concluídos; sem erros ou avisos de execução                                     |

Durante a captura automática do primeiro download houve um timeout da automação antes de acionar o formato. O download foi repetido pelo controle aberto, obtido no disco e conferido com o importador; a exportação da aplicação funcionou.
