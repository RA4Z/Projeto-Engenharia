# AmpAI — workspace de engenharia elétrica

Editor de diagramas unifilares construído em **Next.js, React e TypeScript**, com canvas React Flow. O escopo visual segue os documentos em `Documentação/`; a arquitetura utiliza exclusivamente o frontend nesta fase.

## Executar

```sh
npm install
npm run dev
```

Abra http://127.0.0.1:3000. Para verificar e gerar a versão estática:

```sh
npm run typecheck
npm test
npm run build
npm start
```

O build gera `out/`, que pode ser hospedado em qualquer servidor de arquivos estáticos. `npm start` apenas serve esses arquivos. Não há API, banco de dados, autenticação ou motor de cálculo remoto. As fontes também são servidas localmente.

## Funcionalidades

- Criar, renomear, alternar e excluir projetos. Um exemplo industrial está disponível na primeira abertura e na criação de projetos.
- Biblioteca de concessionária, gerador, transformador, painel, barramento, disjuntor, chave seccionadora, TIE, motor e carga.
- Adicionar com clique ou arrastar e soltar. Seleção, movimentação, zoom, pan, grade magnética, enquadramento e minimapa.
- Conexões entre portas com cabos que preservam origem e destino. A rede deve ser radial, com uma entrada por equipamento, sem ciclos.
- Painéis com hierarquia e propriedades próprias. Arraste um equipamento para um painel ou mude o campo Localização. A movimentação do painel acompanha os subelementos.
- Inspector de equipamentos e cabos, resultados em tempo real e observações de capacidade, tensão e conectividade.
- Duplicação de seleções completas, incluindo painéis e conexões internas. Copiar e colar conjuntos entre projetos pela área de transferência interna do editor, durante a sessão. Cópias recebem IDs novos e rótulos sem colisões; colar posiciona o conjunto no centro da área visível.
- Barra de ações da seleção para enquadrar, copiar, duplicar, excluir e limpar. Resumo próprio no inspector para seleções múltiplas. Ajuste fino com as setas e desfazer/refazer até 60 alterações do projeto atual; segurar uma seta produz uma única entrada no histórico.
- Alinhamento por bordas ou centros e distribuição com espaços iguais, pelo botão Organizar seleção, menu de contexto ou busca rápida. Alinhar exige dois equipamentos móveis; distribuir exige três. Painéis e filhos selecionados não se movem duas vezes. A operação preserva pais e rejeita limites incompatíveis sem alterar parte da seleção.
- Menu com botão direito em equipamentos, cabos e fundo do canvas, com navegação por setas e Esc. O botão do meio continua navegando. Bloqueio de posição no menu, barra e inspector, salvo no JSON como `locked` opcional. Nós bloqueados continuam editáveis, copiáveis e excluíveis; não se movem por arraste, setas, alinhamento ou mudança de painel. Um painel bloqueado fixa seus filhos; um filho bloqueado impede mover seu painel.
- Edição em lote dos campos com a mesma definição entre todos os itens selecionados. Valores distintos aparecem como "Valores diferentes"; apenas o campo editado é aplicado, com validação e uma entrada no histórico. Ctrl/Cmd+clique também permite selecionar vários itens na árvore.
- Prévia de conexão com portas permitidas em verde, rejeitadas em vermelho, motivo antes de soltar e Esc para cancelar. A prévia e a criação usam o mesmo validador de topologia com índices reutilizáveis.
- Busca rápida por Ctrl/Cmd+K ou botão Buscar: encontra equipamentos e cabos, adiciona símbolos e executa ações. Aceita buscas sem acentos e vários termos; correspondências exatas de nome têm prioridade. Setas navegam, Enter executa e Esc fecha, restaurando o foco. O editor fica inerte enquanto a janela está aberta.
- Salvamento automático no `localStorage` do navegador. Exportação e importação JSON com validação de esquema e topologia. Importar o mesmo identificador cria uma cópia.
- Classe de tensão dos cabos (U0/U) no inspector e no JSON. Projetos antigos continuam válidos e recebem "Não informada"; o editor não assume uma isolação para os cabos existentes.
- Menu Exportar com projeto JSON e prévia de PNG/PDF. O desenho inclui todo o grafo, independentemente da câmera; a prévia permite escolher nomes, parâmetros, rótulos, margens, papel A3/A4 e orientação antes de baixar.
- Textos e parâmetros com mais contraste. Zoom abaixo de 45% mostra identificações resumidas; entre 45% e 80%, nomes sem parâmetros; a partir de 80%, detalhes completos. O item selecionado mantém seus detalhes. Os níveis mudam apenas nas transições dessas faixas.
- Barras de ferramentas e seleção em uma faixa própria acima do canvas, sem cobrir equipamentos. Ao selecionar um cabo, aparecem ações de desenho nessa faixa.
- Destacar circuito completo pela barra ou Mostrar alimentação no inspector: evidencia a ramificação até a origem, suaviza os demais itens e permite sair do destaque sem editar o projeto. Observações oferecem Localizar ou Ver propriedades; exclusões oferecem Desfazer na mensagem.
- Cabos com até 20 pontos de dobra, rótulos arrastáveis e ajustes com setas/Shift+setas. Delete sobre uma dobra a remove; Esc cancela um arraste. Restaurar trajeto e rótulo volta ao desenho automático. Os ajustes são reversíveis e salvos no JSON; não alteram o comprimento elétrico. Cópias e movimentações de conjuntos trasladam as dobras dos cabos internos.
- Visão geral dos projetos pelo ícone de pasta no topo: miniaturas esquemáticas, datas, contagens, busca sem acentos, ordenação, abrir, criar, renomear e exportar JSON. Miniaturas de projetos grandes amostram os elementos para limitar o custo da lista.

## Tutorial e tour guiado

Na primeira visita, um convite oferece um tour de 10 passos ou o tutorial do primeiro circuito. O convite pode ser dispensado e a preferência fica neste navegador, separada dos projetos. A ajuda do editor (botão `?`, guia na árvore ou atalho `?`) permite reabrir o tour, ler os seis passos do tutorial e consultar atalhos.

O tour usa [Driver.js](https://driverjs.com/), carregado sob demanda, com textos e botões em português. Abre os painéis necessários a cada passo, permite avançar/voltar pelo teclado e encerrar com Esc. Durante o passeio, o editor fica protegido contra alterações; ao sair, os painéis e a aba anterior são restaurados. Nenhum equipamento, cabo, parâmetro ou seleção é modificado. O tour funciona também com projetos vazios e em telas pequenas, sem backend ou telemetria.

## Exportação visual

PNG e PDF são gerados no navegador. O desenho usa os mesmos símbolos SVG da biblioteca, posições absolutas dos filhos de painéis e a geometria dos cabos, incluindo suas dobras e rótulos reposicionados. O PNG utiliza escala 3×, limitada a 8.192 pixels por lado e 16 megapixels; diagramas muito extensos recebem uma resolução menor e o editor informa esse ajuste. O PDF incorpora essa imagem em uma folha A3 ou A4, com orientação automática/retrato/paisagem e margem escolhida. A prévia usa as mesmas opções e preserva a proporção da folha. É uma exportação visual, sem memorial técnico ou objetos CAD editáveis.

Não há upload para gerar os arquivos. JSON continua sendo o formato de backup e edição. Projetos vazios permitem exportar JSON, mas orientam adicionar um equipamento antes de habilitar PNG/PDF. A geração visual impede disparos simultâneos e informa falhas sem bloquear o editor.

## Cálculos no frontend

Em `lib/calculations.ts`:

- Potência elétrica de motores: `P = potência_no_eixo × demanda / rendimento`.
- Potência de cargas: `P = potência_nominal × demanda`.
- `Q = P × tan(acos(fp))`, `S = hypot(P, Q)`. Agregação soma P e Q, e então calcula S.
- Corrente trifásica equilibrada: `I = S_kVA × 1000 / (√3 × V_linha)`; monofásica: `I = S_kVA × 1000 / V`.
- Transformadores ideais: a tensão secundária alimenta os circuitos a jusante. Não há perdas nem cálculo de curto-circuito.
- Queda de tensão por trecho: `ΔU = k × I × L × (R × fp + X × sinφ)`, com k = √3 em três fases, ou 2 em uma fase. Resistência corrigida pela temperatura, material e paralelos. X é editável em Ω/km.

As premissas, unidades e fórmulas também aparecem na aba Análise. A demanda global inclui todas as cargas, inclusive desconectadas. As correntes de elementos consideram suas cargas a jusante. A queda de tensão é estimativa individual por cabo, não acumulada até a carga. Sistemas mistos geram observações; o modelo não distribui cargas monofásicas entre fases.

Referência da fórmula de queda de tensão: [Electrical Installation Guide, Schneider Electric](https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions).

Esta fase não implementa verificação normativa IEC/NBR, ampacidade, seletividade, curto-circuito, IA, memoriais PDF técnicos, exportação CAD ou colaboração. A impedância do transformador e a curva de disjuntor ficam armazenadas para futuras análises, sem resultados simulados.

## Arquivos JSON

Formato `ampai-project`, versão `1.0.0`, extensão `.json`. O arquivo contém identificação, nome, datas, nós com coordenadas e propriedades, hierarquia dos painéis, arestas `from`/`to` e viewport. A classe de tensão é o campo opcional de entrada `properties.voltage_class` dos cabos, normalizado para `UNSPECIFIED` quando ausente. A viewport pode incluir as dimensões da área de trabalho para adaptar o enquadramento ao abrir o projeto em outra tela. O projeto exemplo está em `public/exemplo-industrial.json`.

O campo opcional `layout` dos cabos armazena `waypoints` (coordenadas absolutas, até 20 pontos) e `labelOffset` (deslocamento relativo do texto). Arquivos antigos continuam válidos. Os ajustes de desenho preservam o cache dos cálculos. Diagramas grandes com trajetos manuais usam visibilidade por limites do desenho, incluindo dobras e rótulos, para manter cabos que cruzam a tela mesmo quando suas pontas estão fora dela.

O importador rejeita propriedades fora do intervalo, IDs duplicados, referências inexistentes, pais inválidos, ciclos e dupla alimentação. Limites: 10 MB por importação, 2.000 equipamentos e 5.000 cabos por arquivo, 100 projetos locais.

O salvamento depende da origem e do armazenamento disponível no navegador. Exportar JSON é a forma de fazer backup e transferir projetos entre dispositivos. Dados de uma sessão local inválida são preservados em `ampai.workspace.v1.recovery` quando o armazenamento permite.

## Atalhos

| Atalho                         | Ação                                            |
| ------------------------------ | ----------------------------------------------- |
| V / H / C                      | Selecionar / navegar / conectar                 |
| F                              | Enquadrar diagrama                              |
| Shift + F                      | Enquadrar seleção (inclui pontas dos cabos)     |
| Ctrl ou Cmd + Z                | Desfazer                                        |
| Ctrl ou Cmd + Shift + Z        | Refazer                                         |
| Ctrl ou Cmd + D                | Duplicar                                        |
| Ctrl ou Cmd + C / V            | Copiar / colar equipamentos e conexões internas |
| Ctrl ou Cmd + A                | Selecionar todos os equipamentos e cabos        |
| Setas / Shift + setas          | Mover seleção 1 / 10 px                         |
| Esc                            | Limpar seleção e voltar ao modo de seleção      |
| Delete / Backspace             | Excluir seleção                                 |
| Ctrl ou Cmd + S                | Exportar JSON                                   |
| Ctrl ou Cmd + K                | Buscar ações, equipamentos e cabos              |
| Ctrl ou Cmd + clique na árvore | Alternar item na seleção múltipla               |
| Botão direito                  | Abrir ações do elemento, seleção ou canvas      |
| Shift + arraste                | Selecionar área                                 |
| ?                              | Abrir guia                                      |

## Organização

`app/`: aplicação Next.js e estilos; `components/`: workspace, canvas, símbolos e inspector; `lib/project.ts`: contrato JSON e operações de grafo; `lib/catalog.ts`: tipos e propriedades; `lib/calculations.ts`: cálculos; `tests/`: testes de engenharia, interação e persistência.

## Estabilidade do editor

O `DiagramCanvas` mantém posições transitórias e medições no estado do React Flow, usando `applyNodeChanges` e `applyEdgeChanges`. O projeto é atualizado apenas ao finalizar o arraste. Uma movimentação de grupo ou painel gera uma única entrada no histórico. Atualizações repetidas sem alterações preservam as referências de estado, e os limites dos subelementos são compartilhados pelo canvas e pelo modelo JSON.

Durante o arraste, a análise elétrica e o salvamento local não são executados novamente. A análise usa índices de nós, conexões e alimentações e acumula as potências do circuito radial em ordem topológica, sem recursão profunda. O inspector recebe a mesma análise calculada pelo workspace.

Ao finalizar movimentos ou alterar a câmera, o cache reutiliza resultados quando os dados elétricos permanecem iguais. Editar parâmetros, conexões, hierarquia ou nomes de elementos atualiza os cálculos e avisos. Edições sem alteração preservam o projeto e o histórico; editar um equipamento mantém a referência da lista de cabos, e vice-versa.

Projetos com mais de 200 equipamentos usam a [renderização apenas de elementos visíveis do React Flow](https://reactflow.dev/api-reference/react-flow#viewport-props). Dimensões fixas e posições das portas permitem calcular e enquadrar conexões mesmo quando os símbolos ainda estão fora da tela. Exportações continuam incluindo o projeto inteiro. Equipamentos agrupados são ordenados com o painel antes dos filhos, tanto após arraste quanto ao mudar Localização.

A validação de JSON usa índices e percorre cada equipamento e cabo uma vez para verificar a topologia, independentemente da ordem do arquivo. A busca aceita espaços nas extremidades e encontra equipamentos e cabos por nome; cabos também podem ser encontrados pela seção. Clicar num cabo na árvore ou num aviso enquadra suas extremidades. Pedidos de enquadramento feitos durante a inicialização prevalecem sobre a câmera salva.

O cursor acompanha o modo: seta na área de seleção, mão na navegação e cruz na conexão. Equipamentos e portas indicam suas interações próprias.

Na recuperação local, projetos válidos são mantidos mesmo se outro projeto estiver corrompido. O conteúdo anterior é copiado para a chave de recuperação; se essa cópia falhar, o editor bloqueia a sobrescrita automática dos dados originais e permite exportar o trabalho em JSON.

Os testes incluem React StrictMode, centenas de alterações de posição e medição, limites de painéis, movimentação em grupo, referências estáveis, recuperação com armazenamento bloqueado e análise de um circuito com 1.900 equipamentos.

A validação de refinamento está registrada em [output/validacao-refinamento.md](output/validacao-refinamento.md). Há testes de importação com BOM, migração da classe de tensão, segurança de textos na exportação, limites de rasterização, 200 operações sucessivas de edição e exportação SVG de 1.900 equipamentos.

A revisão de bugs e desempenho está em [output/validacao-bugs-otimizacao.md](output/validacao-bugs-otimizacao.md), incluindo regressões de alterações agrupadas, cabos fora da tela, cache em StrictMode, câmera durante a inicialização e importação/exportação de projetos grandes.
