import type { Icon } from "@phosphor-icons/react";
import { ListPlus, House, CalendarBlank, Car, CalendarCheck, Users, FileText, Truck, Wrench, Warning, ArrowUUpLeft, ChartLineUp, GearSix } from "@phosphor-icons/react";

export type Destino = {
  path: string; label: string; Icon: Icon;
  /** descrição curta mostrada na tela "em construção" */
  desc: string;
  /** o que a tela vai ter (lista da tela "em construção") */
  itens: string[];
  /** aparece na barra flutuante do celular */
  principal?: boolean;
  curto?: string;
  /** false = ainda não existe de verdade (mostra "em breve") */
  pronto?: boolean;
};

/** Fonte única do menu: barra lateral, gaveta e barra do celular leem daqui. Ordem = ordem do menu. */
export const DESTINOS: Destino[] = [
  { path: "/", label: "Início", Icon: House, desc: "Resumo do dia da frota", pronto: true, principal: true, itens: [] },
  { path: "/planejamento", label: "Planejamento", Icon: CalendarBlank, principal: true, pronto: true, desc: "Veículos e eventos numa linha do tempo só", itens: ["Tabela de veículos com filtros e visões", "Tabela de eventos com filtros e visões", "Linha do tempo infinita com reservas, manutenções e prazos de logística", "Criar evento e manutenção e escolher os carros por aqui"] },
  { path: "/veiculos", label: "Veículos", Icon: Car, principal: true, pronto: true, desc: "Todos os carros, do pedido à devolução", itens: ["Tabela, cards e linha do tempo com visões salvas e colunas congeladas", "Cadastro individual e em massa", "Ciclo de Vida e Status de Uso", "Ficha com atividade, manutenções, eventos, multas, agenda e comentários"] },
  { path: "/eventos", label: "Eventos", Icon: CalendarCheck, principal: true, pronto: true, desc: "Solicitações de uso, reservas e transportes", itens: ["Formulário e cadastro em massa", "Carros por evento, com locais e datas por carro ou para todos", "Status do evento e do contrato"] },
  { path: "/lancamentos", label: "Lançamentos", Icon: ListPlus, pronto: true, desc: "Lançar em massa qualquer coisa do app", itens: ["Faturamento, emplacamento, liberação e devolução de vários veículos", "Novos veículos, eventos e manutenções em tabela", "Checklist de saída e retorno em massa"] },
  { path: "/manutencoes", label: "Manutenções", Icon: Wrench, pronto: true, desc: "Manutenções e sinistros", itens: ["Tipo, status e DA solicitada", "Se o carro ainda pode ir a evento", "Evento responsável preenchido sozinho"] },
  { path: "/multas", label: "Multas", Icon: Warning, desc: "AIT, quem estava com o carro e a cobrança", itens: ["Evento descoberto pela data e hora da infração", "Notificação recebida, pagamento, boleto e cobrança do cliente"] },
  { path: "/devolucoes", label: "Devoluções", Icon: ArrowUUpLeft, desc: "Planejar quais carros saem da frota", itens: ["Sugestões: mais velhos, parados, sem uso", "Devolver ou manter, com data", "Trocas planejadas e meta de 200 carros"] },
  { path: "/financeiro", label: "Dashboard financeiro", Icon: ChartLineUp, desc: "Custos por veículo, evento e mês", itens: ["Transporte, manutenções, multas e seguro", "Por transportadora e por mês"] },
  { path: "/configuracoes", label: "Configurações", Icon: GearSix, desc: "Conta, aparência e backup", itens: ["Aparência", "Backup", "Segurança da conta"] },
];

/** Clientes, contratos, transportes e pagamentos são subpáginas de Eventos: o menu acende "Eventos" nelas. */
const SUBPAGINAS_DE_EVENTOS = ["/clientes", "/contratos", "/transportes"];
export const destinoDoCaminho = (pathname: string) =>
  (SUBPAGINAS_DE_EVENTOS.some((p) => pathname === p || pathname.startsWith(p + "/")) ? DESTINOS.find((d) => d.path === "/eventos") : undefined) ?? DESTINOS.filter((d) => d.path !== "/").find((d) => pathname === d.path || pathname.startsWith(d.path + "/"));
