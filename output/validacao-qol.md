# Validação das melhorias de edição — 12/10/2026

## Implementado

- Oito ações de alinhamento/distribuição por bordas e centros, considerando os tamanhos dos símbolos e as coordenadas absolutas dos filhos. Painéis e filhos selecionados são tratados uma vez; limites incompatíveis e falta de espaço interrompem a operação inteira, sem alterações parciais.
- Menu de contexto para equipamentos, cabos, seleção e fundo. Setas navegam e Esc fecha. O botão do meio mantém a navegação do canvas.
- Bloqueio de posição persistido como `locked?: boolean`, compatível com JSONs anteriores. Protege arraste, setas, alinhamento e reparentamento. Um painel bloqueado fixa filhos; um filho bloqueado impede mover seu painel. Propriedades elétricas continuam editáveis.
- Inspector em lote oferece somente campos com a mesma definição. Valores diferentes não são sobrescritos ao simplesmente focar/sair de um campo. Cada campo confirmado forma uma transação reversível, preservando os outros parâmetros.
- Prévia das conexões com destino permitido/rejeitado, motivo antes de concluir e cancelamento por Esc. Prévia e criação compartilham validação topológica indexada; seletores escalares evitam atualizar todos os símbolos a cada movimento do ponteiro.
- Ctrl/Cmd+K e botão Buscar abrem ações, equipamentos, cabos e biblioteca. Busca sem acentos, termos múltiplos, prioridade para nome exato, navegação por setas/Enter, foco restaurado e fundo inerte. Índices de nós evitam buscas quadráticas na montagem dos comandos.
- Ctrl/Cmd+clique na árvore alterna equipamentos e cabos na seleção múltipla.

## Verificação automatizada

- `npm run typecheck`: aprovado.
- `npm test`: **83 testes passaram**, sem falhas ou testes ignorados.
- `npm run build`: aprovado, exportação estática gerada.
- `git diff --check`: aprovado.

Os testes cobrem alinhamento com símbolos de diferentes tamanhos, espaços iguais, hierarquia, limites atômicos, bloqueio transitório no React Flow, bloqueio de painéis/filhos, JSON antigo/novo, edição parcial em lote, rejeição de números/opções inválidos, ciclos, dupla alimentação, busca e navegação acessível. A prévia foi testada com o estado real do provider React Flow, incluindo mensagem antes de soltar e Esc.

## Verificação no navegador

Versão estática em localhost, desktop de 1280 × 720 e viewport móvel de 390 × 844:

- Menu com botão direito em equipamento, seleção preservada e ações indisponíveis desabilitadas.
- Equipamento bloqueado permaneceu na mesma coordenada ao usar setas; campo Localização ficou desabilitado.
- Três cabos selecionados pela árvore receberam seção de 70 mm² e material alumínio; comprimento original foi preservado. Desfazer restaurou cada alteração.
- Três cargas alinharam à esquerda; desfazer restaurou o desenho. Após mover a carga central, distribuir horizontalmente restaurou os espaços iguais.
- Arraste para destino já alimentado manteve as nove conexões existentes. Arraste para um motor novo criou o décimo cabo. Desfazer restaurou o exemplo.
- Busca sem acentos encontrou a concessionária existente antes de Adicionar Concessionária. Enter localizou o item sem criar outro.
- Ctrl+K dentro de um campo numérico confirmou a edição em lote antes de abrir a busca; Esc restaurou o foco no campo.
- A largura da paleta móvel foi corrigida durante a validação: 358 px, com margens de 16 px em uma tela de 390 px. Resultados, campo e botão fechar ficaram visíveis.
- Nenhum erro ou aviso no console nos cenários inspecionados.

Capturas locais: `tmp/test-artifacts/qol/desktop.jpg` e `tmp/test-artifacts/qol/mobile.jpg`.

Todas as alterações continuam no frontend, com salvamento local e importação/exportação JSON. Nenhuma dependência nova ou backend foi adicionado.
