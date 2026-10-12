# Validação do tutorial e tour — 12/10/2026

Driver.js 1.9.0 implementa o passeio de 10 passos, carregado sob demanda. A ajuda reúne um tutorial de seis etapas e atalhos. O convite da primeira visita pode ser dispensado; essa preferência é independente dos projetos locais. Durante o tour, o editor fica protegido contra alterações, e os painéis, a aba e a seleção são preservados ao sair.

## Verificações automatizadas

- `npm test`: 50 testes aprovados, incluindo os testes anteriores de cálculos, arraste, grafo, importação/exportação e persistência.
- Os novos testes usam o Driver.js real em React StrictMode: navegação, retorno, Esc, conclusão, reabertura, desmontagem durante navegação e encerramento antes de terminar o carregamento. Verificam remoção do overlay e ausência de conclusão falsa ao cancelar.
- Preferências de onboarding toleram armazenamento bloqueado e não sobrescrevem os projetos.
- `npm run typecheck` e `npm run build`: aprovados. A aplicação continua exportada como site estático.

## Verificações no navegador

Testes realizados no navegador integrado, em instâncias locais isoladas de desenvolvimento e do build estático.

| Cenário                                                       | Resultado                                                                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primeira visita → tutorial → atalhos → recarregar             | Ajuda acessível; convite dispensado não reaparece                                                                                                    |
| Tour completo em 1280 × 800, 360 × 780 e 320 × 568            | Todos os balões e controles dentro da tela                                                                                                           |
| Tour em orientação horizontal, 844 × 390                      | Todos os balões dentro da tela após correção da rolagem da descrição                                                                                 |
| Tutorial em tela baixa                                        | Janela dentro da tela e conteúdo acessível por rolagem                                                                                               |
| Avançar/voltar com setas, fechar com botão e Esc              | Navegação e encerramento funcionam                                                                                                                   |
| Tour em projeto vazio                                         | Nenhum equipamento adicionado pelo passeio                                                                                                           |
| Tour sobre diagrama existente                                 | IDs e posições dos equipamentos preservados                                                                                                          |
| Transformador selecionado, aba Análise aberta → tour → fechar | Seleção, painéis e aba preservados                                                                                                                   |
| Tutorial seguido em projeto vazio                             | Concessionária → Transformador → Disjuntor → Carga, quatro equipamentos e três cabos; grafo consistente, zero observações com os parâmetros iniciais |
| Console da versão estática                                    | Sem erros ou avisos de execução nos cenários testados                                                                                                |

O tutorial orienta a revisão dos parâmetros e da classe de tensão dos cabos e distingue JSON editável das saídas visuais PNG/PDF. Os cálculos permanecem preliminares e as premissas são acessíveis pela aba Análise.
