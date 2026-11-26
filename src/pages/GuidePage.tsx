import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  Layers,
  LayoutDashboard,
  Lock,
  Moon,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import type { NavSection } from '../components/AppShell';

interface GuidePageProps {
  onNavigate: (section: NavSection) => void;
  onNewTransaction: () => void;
}

type GuideTopicCategory =
  | 'all'
  | 'start'
  | 'movements'
  | 'cards'
  | 'planning'
  | 'analytics';

interface GuideModuleItem {
  id: string;
  section: NavSection;
  category: Exclude<GuideTopicCategory, 'all'>;
  categoryLabel: string;
  title: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: string[];
  capabilities: string[];
  actionLabel: string;
}

const FILTER_TABS: Array<{ id: GuideTopicCategory; label: string }> = [
  { id: 'all', label: 'Todos os Módulos' },
  { id: 'start', label: 'Primeiros Passos' },
  { id: 'movements', label: 'Movimentações' },
  { id: 'cards', label: 'Cartões e Parcelas' },
  { id: 'planning', label: 'Planejamento' },
  { id: 'analytics', label: 'Análises e Conta' },
];

const QUICK_START_STEPS: Array<{
  step: string;
  title: string;
  description: string;
  actionLabel: string;
  section?: NavSection;
  isNewTransaction?: boolean;
}> = [
  {
    step: '01',
    title: 'Cadastre suas contas financeiras',
    description:
      'Comece pela aba Contas. Confira a conta inicial ou clique em "Nova Conta" para adicionar Carteira, Conta Corrente, Poupança ou Investimentos com o saldo inicial real.',
    actionLabel: 'Ir para Contas',
    section: 'accounts',
  },
  {
    step: '02',
    title: 'Ajuste categorias e cartões fictícios',
    description:
      'Em Categorias, crie seus grupos de receita e despesa com cores. Em Cartões, cadastre apelido, limite, dia de fechamento e vencimento sem informar número real nem CVV.',
    actionLabel: 'Ir para Cartões',
    section: 'cards',
  },
  {
    step: '03',
    title: 'Registre lançamentos, parcelas e fixos',
    description:
      'Use "+ Novo Lançamento" no topo para entradas e saídas, Transferências para mover dinheiro entre contas, Parcelamentos para compras divididas e Recorrências para contas fixas.',
    actionLabel: 'Novo Lançamento',
    isNewTransaction: true,
  },
  {
    step: '04',
    title: 'Defina limites, metas e acompanhe tudo',
    description:
      'Configure tetos mensais em Orçamentos, acompanhe objetivos em Metas, controle Dívidas, visualize seu Patrimônio e exporte seus dados em Relatórios e Exportação.',
    actionLabel: 'Ir para Orçamentos',
    section: 'budgets',
  },
];

const MODULE_GUIDES: GuideModuleItem[] = [
  {
    id: 'dashboard',
    section: 'dashboard',
    category: 'start',
    categoryLabel: 'Visão Geral',
    title: 'Dashboard Financeiro',
    summary:
      'Central de resumo do mês selecionado no cabeçalho, reunindo saldos, faturas, orçamento e fluxo diário.',
    icon: LayoutDashboard,
    steps: [
      'Use as setas "< Mês >" no topo para alternar o mês de referência.',
      'Observe os cartões principais: Saldo em Contas, Receitas do Mês, Despesas do Mês e Faturas em Aberto.',
      'Clique nos atalhos de cada bloco para ir diretamente às telas detalhadas ou criar um novo registro.',
    ],
    capabilities: [
      'Visualizar saldo consolidado das contas ativas e resultado líquido do mês.',
      'Acompanhar o gráfico de fluxo diário entre entradas e saídas.',
      'Ver distribuição de despesas por categoria e status de cada orçamento.',
      'Monitorar limite utilizado por cartão e progresso das metas financeiras.',
    ],
    actionLabel: 'Abrir Dashboard',
  },
  {
    id: 'accounts',
    section: 'accounts',
    category: 'start',
    categoryLabel: 'Estrutura',
    title: 'Contas Financeiras',
    summary:
      'Onde ficam suas carteiras, contas correntes, poupanças e contas de investimento com saldo calculado em tempo real.',
    icon: Landmark,
    steps: [
      'Clique em "Nova Conta" e escolha o nome, tipo (Carteira, Conta Corrente, Poupança ou Investimento) e saldo inicial.',
      'Sempre que registrar receitas, despesas, transferências ou pagamentos de fatura, selecione a conta correspondente.',
      'Se parar de usar uma conta sem perder o histórico, clique em Arquivar; ela pode ser reativada depois.',
    ],
    capabilities: [
      'Criar, editar, arquivar, reativar e excluir contas financeiras.',
      'Acompanhar o saldo atual calculado automaticamente a partir do saldo inicial.',
      'Separar contas ativas das contas arquivadas para manter o visual limpo.',
    ],
    actionLabel: 'Abrir Contas',
  },
  {
    id: 'categories',
    section: 'categories',
    category: 'start',
    categoryLabel: 'Estrutura',
    title: 'Categorias',
    summary:
      'Organiza suas receitas e despesas por assunto para alimentar gráficos, relatórios e limites de orçamento.',
    icon: Tag,
    steps: [
      'Alterne entre as abas de Despesas e Receitas para visualizar as categorias de cada tipo.',
      'Clique em "Nova Categoria", escolha o nome, o tipo (Receita ou Despesa) e selecione uma cor.',
      'Use o ícone de edição para renomear ou trocar a cor sem perder os lançamentos já vinculados.',
    ],
    capabilities: [
      'Criar categorias personalizadas de receita e de despesa com identificador de cor.',
      'Editar nome e cor ou remover categorias que não estejam mais em uso.',
      'Filtrar rapidamente categorias por tipo.',
    ],
    actionLabel: 'Abrir Categorias',
  },
  {
    id: 'transactions',
    section: 'transactions',
    category: 'movements',
    categoryLabel: 'Movimentações',
    title: 'Receitas e Despesas (Lançamentos)',
    summary:
      'Registro detalhado de entradas e saídas à vista em conta ou compras à vista no cartão de crédito.',
    icon: Receipt,
    steps: [
      'Clique em "Novo Lançamento" (na tela ou no botão azul do topo) e escolha Receita ou Despesa.',
      'Informe descrição, valor em reais, data, categoria e método (Conta Financeira ou Cartão de Crédito para despesas).',
      'Defina o status (Pago ou Pendente) e salve. Você pode alternar o status diretamente na lista com um clique.',
    ],
    capabilities: [
      'Buscar lançamentos por descrição e filtrar por tipo (Receita/Despesa), categoria e status.',
      'Marcar lançamentos pendentes como pagos (ou vice-versa) instantaneamente.',
      'Editar dados de qualquer lançamento ou excluir registros indesejados.',
      'Visualizar totais filtrados de receitas, despesas e saldo do período.',
    ],
    actionLabel: 'Abrir Lançamentos',
  },
  {
    id: 'transfers',
    section: 'transfers',
    category: 'movements',
    categoryLabel: 'Movimentações',
    title: 'Transferências entre Contas',
    summary:
      'Move valores entre suas próprias contas (por exemplo, da Conta Corrente para a Poupança) sem distorcer seus gastos.',
    icon: ArrowLeftRight,
    steps: [
      'Clique em "Nova Transferência" e escolha a Conta de Origem e a Conta de Destino.',
      'Informe o valor, a data e uma descrição opcional (ex.: "Reserva mensal").',
      'Salve para atualizar o saldo das duas contas automaticamente.',
    ],
    capabilities: [
      'Registrar, editar e excluir transferências entre quaisquer contas ativas.',
      'Garantir que movimentações internas não sejam somadas como receita nem despesa.',
      'Consultar o histórico de transferências filtrado pelo mês selecionado.',
    ],
    actionLabel: 'Abrir Transferências',
  },
  {
    id: 'cards',
    section: 'cards',
    category: 'cards',
    categoryLabel: 'Crédito',
    title: 'Cartões Fictícios',
    summary:
      'Controle de limites e ciclos de faturamento usando apenas apelido e datas, mantendo sua privacidade total.',
    icon: CreditCard,
    steps: [
      'Clique em "Novo Cartão" e preencha apenas um apelido, limite total, dia de fechamento e dia de vencimento.',
      'Ao lançar uma despesa ou compra parcelada, selecione esse cartão como forma de pagamento.',
      'Acompanhe na barra de progresso quanto do limite já está comprometido e quanto ainda está disponível.',
    ],
    capabilities: [
      'Cadastrar múltiplos cartões fictícios sem armazenar número de cartão, validade ou CVV.',
      'Calcular automaticamente limite utilizado, limite disponível e percentual de uso.',
      'Editar limite/datas de fechamento e vencimento ou remover cartões.',
    ],
    actionLabel: 'Abrir Cartões',
  },
  {
    id: 'invoices',
    section: 'invoices',
    category: 'cards',
    categoryLabel: 'Crédito',
    title: 'Faturas Mensais',
    summary:
      'Agrupa automaticamente as compras à vista e parcelas do cartão conforme o dia de fechamento de cada ciclo.',
    icon: FileText,
    steps: [
      'Navegue até o mês desejado no seletor do topo para ver as faturas daquele vencimento.',
      'Clique em um cartão para conferir todas as compras e parcelas que compõem a fatura.',
      'Para quitar, clique em "Pagar Fatura" e escolha de qual conta o dinheiro vai sair.',
    ],
    capabilities: [
      'Consultar todas as faturas abertas e pagas do mês selecionado com detalhamento por item.',
      'Pagar a fatura debitando automaticamente a conta financeira escolhida (sem duplicar despesa).',
      'Usar "Estornar Pagamento" caso tenha quitado a fatura por engano ou na conta errada.',
    ],
    actionLabel: 'Abrir Faturas',
  },
  {
    id: 'installments',
    section: 'installments',
    category: 'cards',
    categoryLabel: 'Crédito',
    title: 'Compras Parceladas',
    summary:
      'Divide compras em de 2x até 72x, distribuindo o valor exato em centavos nas faturas ou nos meses seguintes.',
    icon: Layers,
    steps: [
      'Clique em "Nova Compra Parcelada", informe descrição, valor total, número de parcelas (2 a 72) e data da compra.',
      'Escolha a categoria e se a compra foi em um Cartão de Crédito ou debitada em Conta Financeira.',
      'O sistema cria todas as parcelas automaticamente; clique na compra para expandir e ver mês a mês.',
    ],
    capabilities: [
      'Dividir o valor total em centavos exatos (ajustando eventuais restos na primeira parcela).',
      'Expandir cada grupo parcelado para acompanhar parcelas já pagas e parcelas futuras.',
      'Excluir o grupo parcelado inteiro de uma só vez quando necessário.',
    ],
    actionLabel: 'Abrir Parcelamentos',
  },
  {
    id: 'recurrences',
    section: 'recurrences',
    category: 'cards',
    categoryLabel: 'Compromissos',
    title: 'Despesas e Receitas Recorrentes',
    summary:
      'Modelos para contas e ganhos periódicos (aluguel, salário, assinaturas) com geração rápida para o mês ativo.',
    icon: Repeat,
    steps: [
      'Clique em "Nova Recorrência" e defina tipo, descrição, valor, categoria, conta ou cartão e frequência (Mensal, Semanal ou Anual).',
      'No mês desejado, clique em "Gerar Pendentes" para criar de uma vez todas as recorrências que ainda não foram lançadas no período.',
      'Se cancelar uma assinatura temporariamente, pause a recorrência sem precisar apagá-la.',
    ],
    capabilities: [
      'Cadastrar recorrências mensais, semanais ou anuais com data de início e fim opcional.',
      'Gerar em lote todas as recorrências pendentes do mês selecionado ou lançar individualmente.',
      'Pausar, reativar, editar ou excluir modelos recorrentes.',
    ],
    actionLabel: 'Abrir Recorrências',
  },
  {
    id: 'budgets',
    section: 'budgets',
    category: 'planning',
    categoryLabel: 'Planejamento',
    title: 'Orçamentos por Categoria',
    summary:
      'Define limites mensais de gastos por categoria de despesa e avisa quando o consumo se aproxima ou passa do teto.',
    icon: PiggyBank,
    steps: [
      'Escolha o mês no seletor superior e clique em "Novo Orçamento" (ou ajuste um existente).',
      'Selecione a categoria de despesa e informe o valor limite planejado para o mês.',
      'Acompanhe a barra de progresso conforme os lançamentos da categoria são registrados.',
    ],
    capabilities: [
      'Definir e editar tetos de gasto por categoria para cada mês.',
      'Receber alertas visuais automáticos ao atingir 80% do limite (atenção) ou ultrapassar 100%.',
      'Remover orçamentos que não deseja mais acompanhar.',
    ],
    actionLabel: 'Abrir Orçamentos',
  },
  {
    id: 'goals',
    section: 'goals',
    category: 'planning',
    categoryLabel: 'Planejamento',
    title: 'Metas Financeiras',
    summary:
      'Acompanha reservas e objetivos específicos (viagem, reserva de emergência, troca de equipamento) com aportes e resgates.',
    icon: Target,
    steps: [
      'Clique em "Nova Meta", dê um título ao objetivo, defina o valor-alvo e um prazo opcional.',
      'Sempre que guardar ou usar dinheiro desse objetivo, clique em "Aportar / Resgatar" e informe o valor.',
      'Ao atingir 100%, a meta é concluída automaticamente (podendo ser reaberta se precisar).',
    ],
    capabilities: [
      'Criar metas financeiras com valor-alvo, valor inicial e data-limite opcional.',
      'Registrar aportes (+) e resgates (-) com atualização imediata do percentual atingido.',
      'Reabrir metas concluídas, editar objetivos ou excluir metas.',
    ],
    actionLabel: 'Abrir Metas',
  },
  {
    id: 'debts',
    section: 'debts',
    category: 'planning',
    categoryLabel: 'Planejamento',
    title: 'Gestão de Dívidas',
    summary:
      'Controla empréstimos, financiamentos e pendências com registro de amortizações e integração opcional com suas contas.',
    icon: Scale,
    steps: [
      'Clique em "Nova Dívida", informe o nome, saldo total original, saldo devedor atual, juros (%) e vencimento opcional.',
      'Quando fizer um pagamento, clique em "Registrar Pagamento" na dívida correspondente.',
      'Opcionalmente, marque a opção para gerar também uma despesa automática na conta financeira escolhida.',
    ],
    capabilities: [
      'Monitorar o saldo devedor total, taxa de juros mensal e progresso de quitação de cada dívida.',
      'Registrar pagamentos parciais ou quitação total, atualizando o saldo devedor na hora.',
      'Lançar automaticamente o pagamento como despesa em uma conta ou apenas abater o saldo da dívida.',
    ],
    actionLabel: 'Abrir Dívidas',
  },
  {
    id: 'networth',
    section: 'networth',
    category: 'planning',
    categoryLabel: 'Planejamento',
    title: 'Patrimônio Líquido',
    summary:
      'Consolida tudo o que você tem (contas e bens/investimentos) menos tudo o que você deve (dívidas e faturas abertas).',
    icon: TrendingUp,
    steps: [
      'Confira o cálculo automático dos saldos das suas Contas e dos Passivos (Dívidas + Faturas em aberto).',
      'Clique em "Novo Ativo" para cadastrar bens e aplicações extras (ex.: Tesouro Direto, ações, imóvel, veículo).',
      'Atualize os valores dos ativos sempre que houver valorização ou resgate para ver a composição no gráfico.',
    ],
    capabilities: [
      'Calcular automaticamente Ativos Brutos, Passivos Totais e Patrimônio Líquido.',
      'Cadastrar, editar e excluir bens e investimentos manuais por tipo de ativo.',
      'Visualizar a distribuição do patrimônio entre ativos e passivos.',
    ],
    actionLabel: 'Abrir Patrimônio',
  },
  {
    id: 'reports',
    section: 'reports',
    category: 'analytics',
    categoryLabel: 'Análises',
    title: 'Relatórios e Exportação',
    summary:
      'Visão histórica de 6 ou 12 meses com gráficos comparativos, ranking de categorias e download completo dos seus dados.',
    icon: BarChart3,
    steps: [
      'Escolha o horizonte de análise (Últimos 6 meses ou Últimos 12 meses) para atualizar os gráficos.',
      'Analise a evolução de Receitas vs. Despesas e o ranking das categorias com maior peso no período.',
      'Clique em "Exportar CSV" para abrir suas transações no Excel/Planilhas ou em "Exportar Backup JSON" para guardar uma cópia completa.',
    ],
    capabilities: [
      'Comparar receitas, despesas e taxa de poupança ao longo de 6 ou 12 meses.',
      'Consultar o ranking das categorias que mais consomem o orçamento.',
      'Exportar todas as transações em formato CSV compatível com planilhas.',
      'Baixar um arquivo JSON completo com todas as entidades do seu espaço financeiro.',
    ],
    actionLabel: 'Abrir Relatórios',
  },
  {
    id: 'settings',
    section: 'settings',
    category: 'analytics',
    categoryLabel: 'Conta e Segurança',
    title: 'Configurações da Conta',
    summary:
      'Personaliza apelido e tema, permite vincular sessões anônimas ao Google e oferece reset seguro do espaço.',
    icon: Settings,
    steps: [
      'Defina o "Apelido do Espaço" e selecione o tema Claro ou Escuro, clicando em salvar.',
      'Se entrou como visitante anônimo e quiser salvar seus dados na nuvem com login permanente, clique em "Vincular com Google".',
      'Caso queira começar do zero com os dados padrão iniciais, use "Resetar Espaço" (ação irreversível com confirmação).',
    ],
    capabilities: [
      'Alterar o apelido exibido na barra lateral e sincronizar o tema visual.',
      'Converter uma conta anônima em conta Google sem perder os registros já criados.',
      'Resetar todos os registros financeiros do espaço quando desejar recomeçar.',
    ],
    actionLabel: 'Abrir Configurações',
  },
  {
    id: 'auth',
    section: 'settings',
    category: 'analytics',
    categoryLabel: 'Conta e Segurança',
    title: 'Acesso, E-mail/Senha, Google e Modo Anônimo',
    summary:
      'Três formas reais de autenticação para isolar seus dados por usuário com segurança no Firebase.',
    icon: Lock,
    steps: [
      'Na tela inicial, você pode entrar com Google, cadastrar/entrar com E-mail e Senha ou testar imediatamente no Modo Anônimo.',
      'Ao criar conta com E-mail e Senha, confirme o link enviado para sua caixa de entrada para liberar o painel.',
      'Esqueceu a senha? Use a opção de redefinição na tela de login por e-mail para receber um link seguro.',
    ],
    capabilities: [
      'Autenticar com Google, E-mail/Senha (com verificação de e-mail) ou sessão Anônima.',
      'Recuperar senha por e-mail e reenviar link de verificação caso necessário.',
      'Manter seus dados isolados por usuário — ninguém mais tem acesso aos seus registros.',
    ],
    actionLabel: 'Ir para Configurações',
  },
];

const GOLDEN_RULES = [
  {
    title: 'Centavos exatos em todo o sistema',
    description:
      'Todos os valores são armazenados e somados em centavos inteiros. Em compras parceladas, eventuais centavos de resto são ajustados automaticamente na primeira parcela.',
  },
  {
    title: 'Zero contagem duplicada',
    description:
      'Transferências entre suas contas e pagamentos de fatura ajustam apenas os saldos das contas envolvidas — nunca inflam artificialmente as receitas ou despesas do mês.',
  },
  {
    title: 'Ciclo automático pela data de fechamento',
    description:
      'Uma compra feita no cartão antes do dia de fechamento entra na fatura do mês corrente; feita no dia de fechamento ou depois, vai para a fatura do mês seguinte.',
  },
  {
    title: 'Privacidade financeira rigorosa',
    description:
      'O FinanceFlow nunca solicita CPF, RG, endereço, agência/conta real, número de cartão, validade ou CVV. Use apenas apelidos para identificar contas e cartões.',
  },
];

export function GuidePage({ onNavigate, onNewTransaction }: GuidePageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GuideTopicCategory>('all');

  const filteredModules = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return MODULE_GUIDES.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        item.title,
        item.categoryLabel,
        item.summary,
        ...item.steps,
        ...item.capabilities,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [searchTerm, selectedCategory]);

  const showQuickStart = selectedCategory === 'all' || selectedCategory === 'start';

  return (
    <div className="space-y-6">
      {/* Hero / Search Header */}
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2563EB] dark:text-blue-400">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Central de Aprendizado FinanceFlow</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Como usar o site passo a passo e tudo que você pode fazer
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Consulte o roteiro inicial recomendado, explore cada módulo do menu lateral com
              instruções práticas e acesse qualquer tela diretamente pelos atalhos abaixo.
            </p>
          </div>

          <div className="w-full lg:w-80 shrink-0">
            <label htmlFor="guide-search" className="sr-only">
              Buscar funcionalidade ou dúvida
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="guide-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar módulo, botão ou dúvida..."
                className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Limpar busca"
                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          {FILTER_TABS.map((tab) => {
            const active = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  active
                    ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-500/15 dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Recommended Onboarding Order */}
      {showQuickStart && !searchTerm.trim() && (
        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Roteiro Inicial — Ordem Recomendada de Uso
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Siga estes 4 passos na primeira vez para deixar seu painel pronto em poucos minutos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {QUICK_START_STEPS.map((item) => (
              <div
                key={item.step}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-[#2563EB] dark:text-blue-400 tabular-nums">
                      PASSO {item.step}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (item.isNewTransaction) {
                      onNewTransaction();
                    } else if (item.section) {
                      onNavigate(item.section);
                    }
                  }}
                  className="inline-flex items-center justify-between gap-2 w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Persistent Top Controls Explanation */}
      {!searchTerm.trim() && selectedCategory === 'all' && (
        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Controles Sempre Disponíveis no Topo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Independentemente da aba aberta, o cabeçalho superior oferece três atalhos fixos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Calendar className="w-4 h-4 text-[#2563EB]" />
                <span>Seletor de Mês (&lt; Mês &gt;)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Define o mês exibido em Dashboard, Lançamentos, Transferências, Faturas,
                Recorrências e Orçamentos. Você pode voltar meses antigos ou planejar meses futuros.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Moon className="w-4 h-4 text-[#2563EB]" />
                <span>Tema Claro e Escuro</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                O botão com ícone de lua/sol alterna instantaneamente entre o tema claro e o modo
                escuro confortável, salvando sua preferência na conta.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Plus className="w-4 h-4 text-[#2563EB]" />
                <span>Botão + Novo Lançamento</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Abre o formulário rápido de receita ou despesa de qualquer lugar do site, sem
                precisar sair da página atual.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Detailed Module-by-Module Guides */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Guia Módulo por Módulo ({filteredModules.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Passo a passo detalhado e lista completa de ações disponíveis em cada área do FinanceFlow.
            </p>
          </div>
        </div>

        {filteredModules.length === 0 ? (
          <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nenhuma funcionalidade encontrada para "{searchTerm}".
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <article
                  key={mod.id}
                  className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 dark:bg-blue-500/15 text-[#2563EB] dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {mod.categoryLabel}
                        </p>
                        <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                          {mod.title}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          {mod.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {mod.id === 'transactions' && (
                        <button
                          type="button"
                          onClick={onNewTransaction}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Testar Novo Lançamento</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigate(mod.section)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white transition-colors"
                      >
                        <span>{mod.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {/* Step-by-step instructions */}
                    <div className="space-y-2.5">
                      <h5 className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                        Como usar passo a passo
                      </h5>
                      <ol className="space-y-2">
                        {mod.steps.map((stepText, idx) => (
                          <li
                            key={stepText}
                            className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                          >
                            <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold font-mono flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                              {idx + 1}
                            </span>
                            <span>{stepText}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Capabilities checklist */}
                    <div className="space-y-2.5">
                      <h5 className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                        Tudo que você consegue fazer
                      </h5>
                      <ul className="space-y-2">
                        {mod.capabilities.map((cap) => (
                          <li
                            key={cap}
                            className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-emerald-400 shrink-0 mt-1" />
                            <span>{cap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Financial Rules & Privacy */}
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#16A34A]" />
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Regras Financeiras e Privacidade do Sistema
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Entenda como o FinanceFlow calcula seus saldos, faturas e protege suas informações.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GOLDEN_RULES.map((rule) => (
            <div
              key={rule.title}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5"
            >
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                {rule.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
