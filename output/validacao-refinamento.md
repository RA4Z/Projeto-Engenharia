# Validação das exportações e refinamento do editor

Data: 12/10/2026. Escopo: classe de tensão dos cabos, PNG/PDF do diagrama e revisão dos fluxos de uso. Todos os cálculos e arquivos continuam sendo gerados no frontend.

## Correções e melhorias

- Classe de tensão U0/U com escolha explícita e persistência JSON. Arquivos anteriores são aceitos com valor "Não informada".
- Exportação PNG do grafo completo em 3×, com limites de 8.192 px por lado e 16 MP. PDF visual em A3 com a mesma imagem, orientação automática e margens.
- Exportação independe de pan/zoom, seleção, minimapa e painéis da interface. Usa o modelo persistente, incluindo filhos de painéis e cabos fora da região visível.
- Menu de formatos com descrições, bloqueio de PNG/PDF em projetos vazios e prevenção de geração simultânea.
- Rótulos de cabos novos não colidem depois de excluir circuitos.
- Inserir equipamentos respeita a grade desligada.
- Retirar um equipamento de um painel nos limites do projeto conserva coordenadas válidas.
- Importação de JSON aceita BOM UTF-8 e informa erro de sintaxe em português.
- Janelas de projeto aceitam Enter, recebem foco e devolvem o foco ao fechar. Campos vazios não criam/renomeiam projetos.
- Ctrl/Cmd+S no inspector conclui a edição do campo e exporta o JSON mais recente. Copiar/colar e setas nos campos mantêm sua função nativa.
- Desfazer/refazer conservam a câmera atual e atualizam a data da revisão.
- A barra de status mostra observações quando há equipamentos sem alimentação, em vez de ocultá-las sob a mensagem de grafo consistente.
- Ao abrir em uma área de trabalho com dimensões bastante diferentes, o diagrama é reenquadrado; em dimensões semelhantes, a câmera salva é restaurada. JSONs antigos continuam aceitos.
- O inspector pode ser fechado pelo próprio cabeçalho, inclusive quando aparece sobre o canvas em tela estreita.

## Uso como iniciante

| Fluxo                                    | Verificação                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| Criar um projeto sem nome                | Botão de criação desabilitado; nenhum projeto inválido criado.                  |
| Digitar um nome e pressionar Enter       | Projeto criado e selecionado.                                                   |
| Exportar um projeto vazio                | JSON disponível; PNG/PDF desabilitados com orientação para inserir equipamento. |
| Inserir o primeiro motor pela biblioteca | Equipamento aparece e fica selecionado, com inspector e resultados.             |
| Informar comprimento negativo            | Valor anterior mantido e mensagem de erro exibida.                              |
| Informar 1,5 condutores em paralelo      | Valor anterior mantido; mensagem esclarece que o número deve ser inteiro.       |
| Apagar o nome do equipamento             | Nome anterior restaurado.                                                       |
| Importar conteúdo que não é JSON         | Erro em português; projeto atual mantido.                                       |
| Importar projeto antigo com BOM          | Grafo carregado; classe dos cabos migrada para "Não informada".                 |
| Editar a classe de um cabo e recarregar  | Valor 8,7/15 kV preservado após recarregar.                                     |
| Menu em tela de 360 px                   | Menu dentro da tela; largura da página não excede a viewport.                   |

## Uso como usuário experiente

| Fluxo                                                 | Verificação                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Arrastar um nó com grade                              | Coordenadas alinhadas; uma transação de histórico ao concluir.                             |
| Arrastar sem grade                                    | Movimento preserva coordenadas fracionárias.                                               |
| Duplicar e selecionar dois motores                    | Ambos selecionados, com ações em grupo.                                                    |
| Arrastar a seleção múltipla                           | Mesma translação aplicada aos dois motores, sem deformar a distância.                      |
| Desfazer o arraste do grupo uma vez                   | Os dois motores voltam às posições anteriores.                                             |
| Ajustar com seta em um nó focado                      | Movimento de 1 px, salvo no modelo; sem movimento duplo do React Flow.                     |
| Duplicar painel com subelementos                      | De 11/9 para 17 equipamentos/13 cabos; filhos e conexões internas preservados.             |
| Desfazer a duplicação                                 | Retorno a 11 equipamentos/9 cabos.                                                         |
| Tentar alimentar novamente um transformador conectado | Conexão rejeitada com mensagem sobre dupla alimentação; contagens preservadas.             |
| Mudar nome para espaços e cancelar                    | Renomear bloqueado; Escape fecha a janela sem alterar o nome.                              |
| Abrir em outra dimensão de tela                       | Enquadramento adaptado; metadados de viewport mantêm compatibilidade com JSONs anteriores. |

## Arquivos exportados

Na versão de produção, em 360 × 780 px, todos os nós ficaram dentro da largura da tela e o inspector abriu/fechou por seu próprio cabeçalho. O menu de exportação permaneceu contido na viewport. No desktop, Ctrl+S foi acionado com o campo Comprimento ainda em edição: o JSON baixado continha `length_m: 42` e `voltage_class: "8.7/15"`, confirmando que o valor mais recente foi incluído. Não houve erros ou avisos de console nesse fluxo de produção.

O navegador gerou PNG de 2.508 × 3.888 px e PDF A3 de uma página, com imagem incorporada na mesma resolução. A inspeção com `pypdf` confirmou página de 841,89 × 1.190,55 pontos e imagem de 2.508 × 3.888 px. O PDF foi renderizado com Poppler e inspecionado visualmente: equipamentos, rótulos, painéis, cabos e classe de tensão presentes, sem barras do editor. A exportação PNG também foi executada no build estático de produção, sem erros ou avisos de console.

As amostras e capturas de validação ficam em `tmp/test-artifacts/refinement/`, que é ignorado pelo Git. O PDF é visual/rasterizado; não é um memorial técnico, PDF vetorial nem arquivo CAD editável. Em diagramas muito extensos, os limites de memória reduzem a escala e isso é informado ao usuário.

## Verificação automatizada

- 48 testes aprovados, incluindo regressões anteriores de React StrictMode, idempotência, importação, cálculos e armazenamento.
- Migração de JSONs antigos, todas as classes do catálogo, rejeição de classe inválida e importação BOM.
- Exportação independente da viewport, coordenadas absolutas dos filhos, escape de textos e rejeição de projeto vazio.
- Limites de rasterização para diagramas com coordenadas extremas.
- 200 operações sucessivas de mover, duplicar, retirar de painel, excluir, serializar e importar.
- SVG completo de 1.900 equipamentos, com coordenadas negativas e nomes longos.
- TypeScript e build estático de produção aprovados.

Esta validação registra cenários executados e limites conhecidos. Não constitui certificação normativa dos cálculos nem garantia de ausência de todo defeito possível.
