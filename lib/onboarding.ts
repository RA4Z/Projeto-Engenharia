export const ONBOARDING_KEY = "ampai:onboarding:v1";

type OnboardingStorage = Pick<Storage, "getItem" | "setItem">;

export function shouldOfferTour(storage: OnboardingStorage): boolean {
  try {
    return storage.getItem(ONBOARDING_KEY) === null;
  } catch {
    return false;
  }
}

export function rememberOnboarding(
  storage: OnboardingStorage,
  status: "dismissed" | "completed",
): void {
  try {
    storage.setItem(ONBOARDING_KEY, status);
  } catch {
    // Onboarding preferences must never prevent access to the editor.
  }
}

export type TourPanel = "projects" | "properties" | "analysis";
export const tourSteps: {
  target?: string;
  panel?: TourPanel;
  title: string;
  description: string;
}[] = [
  {
    title: "Seu primeiro passeio pelo AmpAI",
    description:
      "Conheça o editor em 10 passos. Seu diagrama fica preservado durante o passeio. Use os botões ou as setas do teclado para avançar e voltar; Esc encerra quando quiser.",
  },
  {
    target: "projects",
    panel: "projects",
    title: "Organize seus projetos",
    description:
      "Use o + para criar um projeto vazio ou começar com um exemplo. A árvore abaixo organiza equipamentos, painéis e cabos. Clique em um elemento para encontrá-lo no diagrama.",
  },
  {
    target: "library",
    title: "Escolha os equipamentos",
    description:
      "Clique em um símbolo para adicioná-lo ou arraste até a área de desenho. Em telas pequenas, deslize a biblioteca para ver os demais símbolos. Um equipamento solto dentro de um painel passa a fazer parte dele.",
  },
  {
    target: "tools",
    title: "Selecione, navegue e conecte",
    description:
      "V seleciona e move equipamentos. H arrasta a área de desenho. C conecta: arraste de uma porta de saída até uma entrada. O botão do meio também move a área. Desfazer e refazer ficam nesta barra.",
  },
  {
    target: "zoom",
    title: "Encontre o melhor enquadramento",
    description:
      "Use + e − para ajustar o zoom. O botão de enquadrar ou F mostra todo o projeto. Shift + F enquadra apenas a seleção. Shift + arraste seleciona vários elementos no modo de seleção.",
  },
  {
    target: "inspector",
    panel: "properties",
    title: "Configure equipamentos e cabos",
    description:
      "Depois do tour, selecione um equipamento ou cabo para editar nome e parâmetros aqui. Confira tensão, potência e fases; nos cabos, comprimento, seção, material e classe de tensão. As alterações atualizam os cálculos automaticamente.",
  },
  {
    target: "inspector",
    panel: "analysis",
    title: "Confira os resultados",
    description:
      "A aba Análise reúne cargas, correntes, queda de tensão e avisos. Clique em um aviso para localizar seu elemento. Leia as premissas antes de interpretar os valores: o modelo é radial e os cálculos são preliminares.",
  },
  {
    target: "export",
    title: "Guarde uma cópia do projeto",
    description:
      "O salvamento automático fica neste navegador. Em Exportar, escolha Projeto JSON para guardar um arquivo editável. PNG e PDF geram o diagrama para compartilhar ou imprimir. Ctrl + S exporta o JSON.",
  },
  {
    target: "import",
    title: "Continue de onde parou",
    description:
      "Importar abre um arquivo JSON exportado pelo AmpAI. Ele entra como um projeto no workspace. Use esse arquivo para transferir seu trabalho para outro navegador ou dispositivo.",
  },
  {
    target: "help",
    title: "Agora é sua vez",
    description:
      "Abra esta ajuda a qualquer momento para rever o tour, seguir o tutorial do primeiro circuito ou consultar atalhos. Para praticar, crie um projeto com a opção de diagrama de exemplo e explore seus parâmetros.",
  },
];

export const firstCircuitSteps = [
  [
    "Crie um espaço para praticar",
    "Abra a árvore de projetos e clique em +. Dê um nome e marque “Começar com um diagrama de exemplo” para explorar um circuito pronto, ou deixe desmarcado para desenhar do zero.",
  ],
  [
    "Adicione e organize os símbolos",
    "Em um projeto vazio, adicione Concessionária, Transformador, Disjuntor e Carga. No modo Selecionar (V), arraste os símbolos para organizá-los nessa ordem. Use Painel para agrupar equipamentos e F para ver o conjunto.",
  ],
  [
    "Ligue a alimentação à carga",
    "Ative Conectar (C). Arraste da saída da Concessionária até a entrada do Transformador. Ligue a saída do Transformador à entrada do Disjuntor e a saída do Disjuntor à entrada da Carga. Volte a Selecionar (V) para mover ou editar. Ligações inválidas exibem uma explicação.",
  ],
  [
    "Preencha os parâmetros",
    "Os valores iniciais usam rede de 13.800 V, transformador de 13.800 V para 380 V e carga trifásica de 380 V. Clique na Carga para ajustar potência e fator de potência. Clique em cada cabo para revisar comprimento, seção, material e classe de tensão, considerando a tensão de cada trecho. Os campos indicam suas unidades.",
  ],
  [
    "Entenda os avisos",
    "Abra Análise e consulte os resultados e as premissas. Clique nos avisos para localizar os elementos e revisar seus parâmetros. Cabos mais longos ou de menor seção podem aumentar a queda de tensão. Conexões e valores incorretos precisam ser revisados.",
  ],
  [
    "Salve e compartilhe",
    "Exporte Projeto JSON e guarde o arquivo: ele contém os dados editáveis do projeto. Para continuar em outro dispositivo, use Importar e escolha esse JSON. Exporte PNG ou PDF quando precisar apresentar o diagrama.",
  ],
] as const;
