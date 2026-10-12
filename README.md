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
- Salvamento automático no `localStorage` do navegador. Exportação e importação JSON com validação de esquema e topologia. Importar o mesmo identificador cria uma cópia.

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

Esta fase não implementa verificação normativa IEC/NBR, ampacidade, seletividade, curto-circuito, IA, exportação PDF/CAD ou colaboração. A impedância do transformador e a curva de disjuntor ficam armazenadas para futuras análises, sem resultados simulados.

## Arquivos JSON

Formato `ampai-project`, versão `1.0.0`, extensão `.json`. O arquivo contém identificação, nome, datas, nós com coordenadas e propriedades, hierarquia dos painéis, arestas `from`/`to` e viewport. O projeto exemplo está em `public/exemplo-industrial.json`.

O importador rejeita propriedades fora do intervalo, IDs duplicados, referências inexistentes, pais inválidos, ciclos e dupla alimentação. Limites: 10 MB por importação, 2.000 equipamentos e 5.000 cabos por arquivo, 100 projetos locais.

O salvamento depende da origem e do armazenamento disponível no navegador. Exportar JSON é a forma de fazer backup e transferir projetos entre dispositivos. Dados de uma sessão local inválida são preservados em `ampai.workspace.v1.recovery` quando o armazenamento permite.

## Atalhos

| Atalho                  | Ação                                            |
| ----------------------- | ----------------------------------------------- |
| V / H / C               | Selecionar / navegar / conectar                 |
| F                       | Enquadrar diagrama                              |
| Shift + F               | Enquadrar seleção (inclui pontas dos cabos)     |
| Ctrl ou Cmd + Z         | Desfazer                                        |
| Ctrl ou Cmd + Shift + Z | Refazer                                         |
| Ctrl ou Cmd + D         | Duplicar                                        |
| Ctrl ou Cmd + C / V     | Copiar / colar equipamentos e conexões internas |
| Ctrl ou Cmd + A         | Selecionar todos os equipamentos e cabos        |
| Setas / Shift + setas   | Mover seleção 1 / 10 px                         |
| Esc                     | Limpar seleção e voltar ao modo de seleção      |
| Delete / Backspace      | Excluir seleção                                 |
| Ctrl ou Cmd + S         | Exportar JSON                                   |
| Shift + arraste         | Selecionar área                                 |
| ?                       | Abrir guia                                      |

## Organização

`app/`: aplicação Next.js e estilos; `components/`: workspace, canvas, símbolos e inspector; `lib/project.ts`: contrato JSON e operações de grafo; `lib/catalog.ts`: tipos e propriedades; `lib/calculations.ts`: cálculos; `tests/`: testes de engenharia, interação e persistência.

## Estabilidade do editor

O `DiagramCanvas` mantém posições transitórias e medições no estado do React Flow, usando `applyNodeChanges` e `applyEdgeChanges`. O projeto é atualizado apenas ao finalizar o arraste. Uma movimentação de grupo ou painel gera uma única entrada no histórico. Atualizações repetidas sem alterações preservam as referências de estado, e os limites dos subelementos são compartilhados pelo canvas e pelo modelo JSON.

Durante o arraste, a análise elétrica e o salvamento local não são executados novamente. A análise usa índices de nós, conexões e alimentações e acumula as potências do circuito radial em ordem topológica, sem recursão profunda. O inspector recebe a mesma análise calculada pelo workspace.

O cursor acompanha o modo: seta na área de seleção, mão na navegação e cruz na conexão. Equipamentos e portas indicam suas interações próprias.

Na recuperação local, projetos válidos são mantidos mesmo se outro projeto estiver corrompido. O conteúdo anterior é copiado para a chave de recuperação; se essa cópia falhar, o editor bloqueia a sobrescrita automática dos dados originais e permite exportar o trabalho em JSON.

Os testes incluem React StrictMode, centenas de alterações de posição e medição, limites de painéis, movimentação em grupo, referências estáveis, recuperação com armazenamento bloqueado e análise de um circuito com 1.900 equipamentos.
