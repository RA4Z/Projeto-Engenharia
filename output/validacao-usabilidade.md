# Validação das melhorias de usabilidade — 12/10/2026

## Entrega

As oito melhorias solicitadas foram implementadas: contraste/tipografia, detalhes por zoom, destaque do caminho de alimentação, trajetos e rótulos editáveis, barras fora do desenho, prévia de exportação, visão geral de projetos e mensagens com ações diretas. Tudo permanece no frontend, sem dependências novas ou backend.

O desenho dos cabos é armazenado no JSON como `layout.waypoints` e `layout.labelOffset`, ambos opcionais para compatibilidade. A mesma geometria é usada no canvas e na exportação. Arrastes são transitórios até soltar; uma operação confirmada gera uma entrada no histórico. Ajustes visuais não modificam o comprimento do cabo nem invalidam os cálculos elétricos.

## Verificações

- `npm run typecheck`: aprovado.
- `npm test`: **96 testes passaram**, sem falhas ou testes ignorados.
- `npm run build`: aprovado, exportação estática gerada.
- `git diff --check`: aprovado.

Testes novos cobrem ortogonalidade, limites e JSON, reset do desenho, isolamento de cópias, deslocamento de cabos internos com painéis/conjuntos, cache de análise, ramificações e origem de alimentação, enquadramento da exportação, papel/orientação/margens, visibilidade de trajetos fora dos endpoints, faixas de zoom sem renderizações a cada movimento, visão geral e ações distintas nas observações.

## Uso real no navegador

Versão estática testada em desktop 1280 × 720 e viewport móvel 390 × 844:

- O motor do exemplo destacou seis equipamentos e cinco cabos até a concessionária. Os demais ramos foram suavizados, preservando o painel que contém os itens destacados.
- A área do canvas começou exatamente depois da faixa de ferramentas; nenhuma barra ficou sobre o desenho.
- Uma dobra de C-04 foi ajustada com Shift+seta e com arraste; seu rótulo também foi arrastado. O comprimento permaneceu 2 m e a corrente 87,4 A. Não houve erros no console.
- Exclusão de C-04 reduziu nove conexões para oito. Desfazer na mensagem restaurou o cabo com seu desenho.
- O JSON baixado foi inspecionado: 11 equipamentos, nove cabos e o layout de C-04 com ponto `{x:375,y:758}` e deslocamento de rótulo `{x:-100,y:-60}`.
- PDF A4 em paisagem foi baixado com margem de 20 mm. O arquivo válido contém MediaBox de aproximadamente 841,89 × 595,28 pontos. A proporção da prévia foi confirmada em 1,41432, correspondente à folha 297 × 210 mm.
- A visão geral criou um projeto vazio, encontrou um projeto sem acentos e renomeou um projeto inativo sem trocar o projeto aberto.
- Na tela móvel, a prévia ocupou 366 × 820 px, com margens de 12 px dentro da viewport 390 × 844.
- O projeto de teste com 1.900 equipamentos e 1.899 cabos importou corretamente. A localização de um item distante funcionou. Em uma região com um trajeto manual e duas pontas fora da tela, o cabo continuou renderizado; ambas as pontas estavam ausentes do DOM e apenas 49 equipamentos estavam desenhados naquela vista.
- Os logs inspecionados não apresentaram erros ou avisos.

Foram corrigidos durante a validação: interceptação do arraste das dobras pela camada de seleção, proporção da folha de prévia e menu de exportação encoberto pelo inspector no celular. O conteúdo prévio de `next-env.d.ts` foi preservado; já estava modificado pelo ambiente de desenvolvimento antes desta tarefa.

Capturas e fixtures locais ficam em `tmp/test-artifacts/usability/`. Os downloads de teste ficam em `C:/Users/rraz6/Downloads/validacao-usabilidade.pdf` e `C:/Users/rraz6/Downloads/instalacao-industrial-revisada.json`.
