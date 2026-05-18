-- ============================================================
-- JEITO DE SER — Schema Completo do Banco de Dados
-- Supabase / PostgreSQL
-- ============================================================

-- ─────────────────────────────────────────
-- EXTENSÕES
-- ─────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- busca por texto

-- ─────────────────────────────────────────
-- EMPRESA
-- ─────────────────────────────────────────
create table empresa (
  id              uuid primary key default uuid_generate_v4(),
  nome            text not null,
  cnpj            text,
  inscricao_estadual text,
  inscricao_municipal text,
  endereco        text,
  numero          text,
  bairro          text,
  cidade          text,
  uf              text,
  cep             text,
  fone_comercial  text,
  email           text,
  banco           text,
  agencia         text,
  conta_corrente  text,
  site            text,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- USUÁRIOS / CONTROLE DE ACESSO
-- ─────────────────────────────────────────
create table perfis_usuario (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade,
  nome            text not null,
  cargo           text,
  perfil          text not null default 'funcionario', -- 'admin' | 'funcionario'
  ativo           boolean default true,
  -- permissões granulares
  ver_dashboard       boolean default true,
  ver_vendas          boolean default true,
  fazer_vendas        boolean default true,
  ver_clientes        boolean default true,
  editar_clientes     boolean default false,
  ver_produtos        boolean default true,
  editar_produtos     boolean default false,
  ver_financeiro      boolean default false,
  ver_compras         boolean default false,
  ver_relatorios      boolean default false,
  ver_whatsapp        boolean default false,
  ver_configuracoes   boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- CLIENTES
-- ─────────────────────────────────────────
create table clientes (
  id                    bigserial primary key,
  codigo_legado         integer unique, -- código original do Access
  nome                  text not null,
  data_nascimento       date,
  estado_civil          text,
  conjuge               text,
  conjuge_telefone      text,
  endereco              text,
  numero                text,
  bairro                text,
  cidade                text,
  estado                text,
  cep                   text,
  complemento           text,
  telefone              text,
  celular               text,
  whatsapp              text,
  whatsapp_ativo        boolean default false,
  email                 text,
  cpf                   text,
  identidade            text,
  cnpj                  text,
  inscricao_estadual    text,
  tipo_pessoa           text default 'Física',
  renda                 text,
  trabalho_nome         text,
  trabalho_telefone     text,
  trabalho_cargo        text,
  trabalho_tempo        text,
  ref_comercial         text,
  ref_comercial_tel     text,
  ref_pessoal1          text,
  ref_pessoal1_tel      text,
  ref_pessoal2          text,
  ref_pessoal2_tel      text,
  filiacao_mae          text,
  filiacao_mae_tel      text,
  filiacao_pai          text,
  filiacao_pai_tel      text,
  filho                 text,
  filho_telefone        text,
  autorizados           text,
  naturalidade          text,
  categoria             text, -- 'Crediário' | 'Avista' | 'Pendente'
  perfil                text,
  tamanho               text,
  tamanho2              text,
  tamanho3              text,
  limite_credito        numeric(10,2) default 0,
  credito_troca         numeric(10,2) default 0,
  desconto_familia      numeric(5,2) default 0,
  rede_social           text,
  rede_social_add       boolean default false,
  observacao            text,
  ativo                 boolean default true,
  data_cadastro         timestamptz default now(),
  updated_at            timestamptz default now()
);

create index idx_clientes_nome on clientes using gin(nome gin_trgm_ops);
create index idx_clientes_cpf on clientes(cpf);
create index idx_clientes_celular on clientes(celular);
create index idx_clientes_aniversario on clientes(extract(month from data_nascimento), extract(day from data_nascimento));

-- ─────────────────────────────────────────
-- FORNECEDORES
-- ─────────────────────────────────────────
create table fornecedores (
  id              bigserial primary key,
  codigo_legado   integer unique,
  nome            text not null,
  contato         text,
  endereco        text,
  numero          text,
  bairro          text,
  cidade          text,
  estado          text,
  cep             text,
  telefone        text,
  celular         text,
  email           text,
  cnpj            text,
  cpf             text,
  inscricao_estadual text,
  identidade      text,
  tipo_pessoa     text,
  atividade       text,
  ativo           boolean default true,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- FUNCIONÁRIOS
-- ─────────────────────────────────────────
create table funcionarios (
  id              bigserial primary key,
  codigo_legado   integer unique,
  nome            text not null,
  funcao          text,
  endereco        text,
  numero          text,
  bairro          text,
  cidade          text,
  estado          text,
  cep             text,
  telefone        text,
  celular         text,
  email           text,
  cpf             text,
  identidade      text,
  data_entrada    date,
  ativo           boolean default true,
  observacao      text,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- PRODUTOS
-- ─────────────────────────────────────────
create table produtos (
  id              bigserial primary key,
  codigo_legado   integer unique,
  grupo           text,
  sub_grupo       text,
  partes          text,
  medida          text,
  descricao       text not null,
  cod_barras      text,
  cod_referencia  text,
  marca           text,
  cor             text,
  tamanho         text,
  fornecedor      text,
  localizacao     text,
  aplicacao       text,
  estoque         numeric(10,2) default 0,
  estoque_minimo  integer default 1,
  preco_custo     numeric(10,2) default 0,
  margem_lucro    numeric(5,2) default 0,
  preco_venda     numeric(10,2) not null default 0,
  permite_desconto boolean default true,
  ativo           boolean default true,
  atualizado_em   timestamptz default now(),
  created_at      timestamptz default now()
);

create index idx_produtos_descricao on produtos using gin(descricao gin_trgm_ops);
create index idx_produtos_cod_barras on produtos(cod_barras);
create index idx_produtos_grupo on produtos(grupo);

-- ─────────────────────────────────────────
-- VENDAS
-- ─────────────────────────────────────────
create table vendas (
  id              bigserial primary key,
  codigo_legado   integer unique,
  vendedor        text,
  data            date not null default current_date,
  cod_cliente     bigint references clientes(id),
  nome_cliente    text not null,
  desc_porcentagem numeric(5,2) default 0,
  desc_valor      numeric(10,2) default 0,
  valor_total     numeric(10,2) not null,
  situacao        text default 'Venda', -- 'Venda' | 'Venda Direta' | 'Cancelada'
  forma_pagamento text,
  observacao      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_vendas_data on vendas(data);
create index idx_vendas_cliente on vendas(cod_cliente);
create index idx_vendas_situacao on vendas(situacao);

create table vendas_itens (
  id              bigserial primary key,
  codigo_legado   integer,
  cod_venda       bigint not null references vendas(id) on delete cascade,
  cod_produto     bigint references produtos(id),
  produto         text not null,
  preco_venda     numeric(10,2) not null,
  quantidade      integer not null default 1,
  sub_total       numeric(10,2) not null,
  desconto_valor  numeric(10,2) default 0,
  desconto_pct    numeric(5,2) default 0
);

create index idx_vendas_itens_venda on vendas_itens(cod_venda);

create table vendas_pagamento (
  id              bigserial primary key,
  codigo_legado   integer,
  cod_venda       bigint not null references vendas(id) on delete cascade,
  data            date not null,
  forma           text not null, -- 'Dinheiro' | 'Cartão' | 'PIX' | 'Crediário' | 'Boleto'
  operadora       text,
  conta           text,
  valor           numeric(10,2) not null,
  parcela         text,
  conta_a_receber boolean default false
);

-- ─────────────────────────────────────────
-- CONTAS A RECEBER (CREDIÁRIO)
-- ─────────────────────────────────────────
create table contas_a_receber (
  id                  bigserial primary key,
  codigo_legado       integer unique,
  cod_cliente         bigint references clientes(id),
  cod_venda           bigint references vendas(id),
  parcela             text,
  data_lancamento     date not null default current_date,
  data_vencimento     date not null,
  data_cobranca       date,
  valor               numeric(10,2) not null,
  juros               numeric(10,2) default 0,
  taxa                numeric(10,2) default 0,
  saldo_devedor       numeric(10,2) default 0,
  historico           text,
  condicao            text,
  status              text default 'Em aberto', -- 'Em aberto' | 'Pago' | 'Vencido' | 'Renegociado'
  pago                boolean default false,
  inadimplente        boolean default false,
  -- whatsapp
  msg_enviada_5d      boolean default false, -- mensagem enviada 5 dias antes
  msg_enviada_5d_em   timestamptz,
  created_at          timestamptz default now()
);

create index idx_car_cliente on contas_a_receber(cod_cliente);
create index idx_car_vencimento on contas_a_receber(data_vencimento);
create index idx_car_pago on contas_a_receber(pago);
create index idx_car_inadimplente on contas_a_receber(inadimplente);

create table recebimentos (
  id              bigserial primary key,
  codigo_legado   integer,
  cod_conta       bigint references contas_a_receber(id),
  cod_cliente     bigint references clientes(id),
  cod_venda       bigint references vendas(id),
  data_pgto       date not null,
  forma_pgto      text,
  valor_recebido  numeric(10,2) not null,
  entrada         text,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- CONTAS A PAGAR
-- ─────────────────────────────────────────
create table contas_a_pagar (
  id              bigserial primary key,
  codigo_legado   integer unique,
  cod_compra      bigint,
  despesa         text,
  descricao       text,
  documento       text,
  parcela         text,
  data            date not null default current_date,
  data_vencimento date not null,
  valor           numeric(10,2) not null,
  juros           numeric(10,2) default 0,
  desconto        numeric(10,2) default 0,
  taxa            numeric(10,2) default 0,
  saldo_devedor   numeric(10,2) default 0,
  historico       text,
  forma_pgto      text,
  plano_contas    text,
  status          text default 'Em aberto',
  pago            boolean default false,
  created_at      timestamptz default now()
);

create index idx_cap_vencimento on contas_a_pagar(data_vencimento);
create index idx_cap_pago on contas_a_pagar(pago);

create table pagamentos (
  id              bigserial primary key,
  codigo_legado   integer,
  cod_conta       bigint references contas_a_pagar(id),
  data            date not null,
  valor           numeric(10,2) not null,
  forma_pgto      text,
  retirada        text,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- COMPRAS
-- ─────────────────────────────────────────
create table compras (
  id              bigserial primary key,
  codigo_legado   integer unique,
  data            date not null,
  nota_numero     integer,
  cod_fornecedor  bigint references fornecedores(id),
  grupo           text,
  evento          text,
  valor_total     numeric(10,2) not null,
  documento       text,
  created_at      timestamptz default now()
);

create table compras_itens (
  id              bigserial primary key,
  codigo_legado   integer,
  cod_compra      bigint not null references compras(id) on delete cascade,
  cod_produto     bigint references produtos(id),
  produto         text not null,
  cod_barras      text,
  referencia      text,
  quantidade      integer not null,
  valor_unitario  numeric(10,2) not null,
  sub_total       numeric(10,2) not null,
  preco_venda     numeric(10,2),
  margem_valor    numeric(10,2),
  margem_porcent  numeric(5,2),
  sub_grupo       text,
  partes          text,
  tamanho         text,
  cor             text,
  marca           text,
  atualiza_estoque boolean default true,
  atualiza_preco  boolean default false,
  detalhes        text
);

-- ─────────────────────────────────────────
-- TROCAS
-- ─────────────────────────────────────────
create table vendas_trocas (
  id              bigserial primary key,
  codigo_legado   integer unique,
  cod_venda_orig  bigint references vendas(id),
  cod_cliente     bigint references clientes(id),
  nome_cliente    text,
  vendedor        text,
  data            date not null default current_date,
  valor_original  numeric(10,2),
  valor_troca     numeric(10,2),
  diferenca       numeric(10,2),
  status          text default 'Aberta',
  observacao      text,
  created_at      timestamptz default now()
);

create table vendas_trocas_itens (
  id              bigserial primary key,
  codigo_legado   integer,
  cod_troca       bigint references vendas_trocas(id) on delete cascade,
  cod_produto     bigint references produtos(id),
  produto         text not null,
  quantidade      integer default 1,
  valor           numeric(10,2) not null
);

-- ─────────────────────────────────────────
-- FLUXO DE CAIXA
-- ─────────────────────────────────────────
create table fluxo_caixa (
  id              bigserial primary key,
  codigo_legado   integer unique,
  tipo_caixa      text,
  despesa         text,
  descricao       text,
  credito         numeric(10,2) default 0,
  debito          numeric(10,2) default 0,
  data            date not null,
  historico       text,
  tipo            text, -- 'C' credito | 'D' debito
  condicao        text,
  plano_contas    text,
  created_at      timestamptz default now()
);

create index idx_fluxo_data on fluxo_caixa(data);

-- ─────────────────────────────────────────
-- FECHAMENTO DE CAIXA
-- ─────────────────────────────────────────
create table fechamento_caixa (
  id              bigserial primary key,
  codigo_legado   integer unique,
  data            date not null,
  usuario         text,
  saldo_anterior  numeric(10,2) default 0,
  entradas        numeric(10,2) default 0,
  saidas          numeric(10,2) default 0,
  saldo_final     numeric(10,2) default 0,
  observacao      text,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- LEMBRETES
-- ─────────────────────────────────────────
create table lembretes (
  id              bigserial primary key,
  codigo_legado   integer,
  titulo          text,
  descricao       text,
  data_lembrete   date,
  concluido       boolean default false,
  usuario         text,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- WHATSAPP — MODELOS DE MENSAGEM
-- ─────────────────────────────────────────
create table whatsapp_modelos (
  id              uuid primary key default uuid_generate_v4(),
  tipo            text not null unique, -- 'aniversario' | 'cobranca_5d' | 'cobranca_vencimento' | 'cobranca_atraso'
  nome            text not null,
  mensagem        text not null,
  ativo           boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Inserir modelos padrão
insert into whatsapp_modelos (tipo, nome, mensagem) values
('aniversario',
 'Feliz Aniversário',
 'Olá *{nome}*! 🌸 A equipe Jeito de Ser deseja a você um feliz aniversário! Que seu dia seja repleto de alegria e realizações. 🎂✨ Venha nos visitar e ganhe um presente especial. Te esperamos com carinho! 💛 *Jeito de Ser Fashion*'),
('cobranca_5d',
 'Aviso de Vencimento - 5 dias',
 'Olá *{nome}*, tudo bem? 😊 Passamos para lembrá-la que a parcela *{parcela}* no valor de *{valor}* vence em *5 dias* ({data_vencimento}). Se preferir, pode efetuar o pagamento antecipado. Qualquer dúvida, estamos à disposição! 💛 *Jeito de Ser Fashion*'),
('cobranca_vencimento',
 'Aviso de Vencimento - No dia',
 'Olá *{nome}*, bom dia! ☀️ Sua parcela *{parcela}* no valor de *{valor}* vence *hoje* ({data_vencimento}). Por favor, efetue o pagamento para manter seu crédito em dia. 💛 *Jeito de Ser Fashion*'),
('cobranca_atraso',
 'Cobrança - Em atraso',
 'Olá *{nome}*. Identificamos que sua parcela *{parcela}* no valor de *{valor}* com vencimento em {data_vencimento} está em atraso. Por favor, entre em contato conosco para regularizar. 📞 (31) 3741-3668 💛 *Jeito de Ser Fashion*');

-- ─────────────────────────────────────────
-- WHATSAPP — LOG DE ENVIOS
-- ─────────────────────────────────────────
create table whatsapp_logs (
  id              uuid primary key default uuid_generate_v4(),
  tipo            text not null,
  cod_cliente     bigint references clientes(id),
  numero          text not null,
  mensagem        text not null,
  status          text default 'enviado', -- 'enviado' | 'erro' | 'pendente'
  erro            text,
  enviado_em      timestamptz default now()
);

create index idx_wlogs_cliente on whatsapp_logs(cod_cliente);
create index idx_wlogs_tipo on whatsapp_logs(tipo);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table empresa enable row level security;
alter table perfis_usuario enable row level security;
alter table clientes enable row level security;
alter table fornecedores enable row level security;
alter table funcionarios enable row level security;
alter table produtos enable row level security;
alter table vendas enable row level security;
alter table vendas_itens enable row level security;
alter table vendas_pagamento enable row level security;
alter table contas_a_receber enable row level security;
alter table recebimentos enable row level security;
alter table contas_a_pagar enable row level security;
alter table pagamentos enable row level security;
alter table compras enable row level security;
alter table compras_itens enable row level security;
alter table fluxo_caixa enable row level security;
alter table fechamento_caixa enable row level security;
alter table lembretes enable row level security;
alter table whatsapp_modelos enable row level security;
alter table whatsapp_logs enable row level security;

-- Política: usuários autenticados veem tudo (o controle granular é no app)
create policy "Acesso autenticado" on clientes for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on fornecedores for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on funcionarios for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on produtos for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on vendas for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on vendas_itens for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on vendas_pagamento for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on contas_a_receber for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on recebimentos for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on contas_a_pagar for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on pagamentos for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on compras for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on compras_itens for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on fluxo_caixa for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on fechamento_caixa for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on lembretes for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on empresa for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on whatsapp_modelos for all using (auth.role() = 'authenticated');
create policy "Acesso autenticado" on whatsapp_logs for all using (auth.role() = 'authenticated');
create policy "Próprio perfil" on perfis_usuario for all using (auth.uid() = user_id or exists (
  select 1 from perfis_usuario p where p.user_id = auth.uid() and p.perfil = 'admin'
));

-- ─────────────────────────────────────────
-- FUNÇÕES ÚTEIS
-- ─────────────────────────────────────────

-- Aniversariantes hoje
create or replace function aniversariantes_hoje()
returns setof clientes language sql as $$
  select * from clientes
  where extract(month from data_nascimento) = extract(month from current_date)
    and extract(day from data_nascimento) = extract(day from current_date)
    and ativo = true
    and whatsapp is not null;
$$;

-- Vencimentos nos próximos N dias
create or replace function vencimentos_proximos(dias int default 5)
returns table(
  id bigint, cod_cliente bigint, nome_cliente text,
  whatsapp text, parcela text, valor numeric,
  data_vencimento date, dias_para_vencer int
) language sql as $$
  select
    car.id, c.id as cod_cliente, c.nome,
    c.whatsapp, car.parcela, car.valor,
    car.data_vencimento,
    (car.data_vencimento - current_date)::int as dias_para_vencer
  from contas_a_receber car
  join clientes c on c.id = car.cod_cliente
  where car.pago = false
    and car.data_vencimento between current_date and (current_date + dias)
    and c.whatsapp is not null
  order by car.data_vencimento;
$$;

-- Dashboard resumo do dia
create or replace function resumo_dia(data_ref date default current_date)
returns json language sql as $$
  select json_build_object(
    'vendas_hoje', (
      select json_build_object(
        'total', coalesce(sum(valor_total), 0),
        'quantidade', count(*)
      ) from vendas where data = data_ref and situacao != 'Cancelada'
    ),
    'a_receber_total', (
      select json_build_object(
        'total', coalesce(sum(valor), 0),
        'quantidade', count(*)
      ) from contas_a_receber where pago = false
    ),
    'vencendo_hoje', (
      select json_build_object(
        'total', coalesce(sum(valor), 0),
        'quantidade', count(*)
      ) from contas_a_receber where pago = false and data_vencimento = data_ref
    ),
    'vencendo_5_dias', (
      select json_build_object(
        'total', coalesce(sum(valor), 0),
        'quantidade', count(*)
      ) from contas_a_receber
      where pago = false
        and data_vencimento between data_ref and (data_ref + 5)
    ),
    'inadimplentes', (
      select json_build_object(
        'total', coalesce(sum(valor), 0),
        'quantidade', count(*)
      ) from contas_a_receber where pago = false and data_vencimento < data_ref
    ),
    'a_pagar_hoje', (
      select json_build_object(
        'total', coalesce(sum(valor), 0),
        'quantidade', count(*)
      ) from contas_a_pagar where pago = false and data_vencimento = data_ref
    ),
    'estoque_baixo', (
      select count(*) from produtos where estoque <= estoque_minimo and ativo = true
    ),
    'aniversariantes_hoje', (
      select count(*) from aniversariantes_hoje()
    )
  );
$$;
