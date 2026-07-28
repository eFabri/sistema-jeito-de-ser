-- 006_caixa.sql — Módulo de Caixa (abertura, fechamento, sangria, suprimento)

CREATE TABLE IF NOT EXISTS caixa_diario (
  id               bigint        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  data             date          NOT NULL UNIQUE,
  valor_abertura   numeric(12,2) NOT NULL DEFAULT 0,
  aberto_por       text,
  aberto_em        timestamptz   NOT NULL DEFAULT now(),
  valor_contado    numeric(12,2),
  fechado_por      text,
  fechado_em       timestamptz,
  status           text          NOT NULL DEFAULT 'aberto'
                                 CHECK (status IN ('aberto','fechado')),
  detalhamento     jsonb,
  historico_reabertura jsonb     DEFAULT '[]'::jsonb,
  observacoes      text,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caixa_movimentos (
  id          bigint        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  caixa_id    bigint        NOT NULL REFERENCES caixa_diario(id),
  tipo        text          NOT NULL CHECK (tipo IN ('sangria','suprimento')),
  valor       numeric(12,2) NOT NULL CHECK (valor > 0),
  motivo      text,
  criado_por  text,
  criado_em   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caixa_diario_data   ON caixa_diario (data DESC);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentos_id ON caixa_movimentos (caixa_id);
