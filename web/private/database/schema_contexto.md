-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.tb_cli (
  id_cliente bigint NOT NULL,
  nome text NOT NULL,
  senha text,
  email text,
  num_tel numeric,
  cep numeric,
  CONSTRAINT tb_cli_pkey PRIMARY KEY (id_cliente)
);
CREATE TABLE public.tb_veiculo (
  id_veiculo bigint NOT NULL,
  placa numeric NOT NULL,
  marca text,
  modelo text,
  ano_do_modelo numeric,
  km_atual numeric,
  cliente_id bigint,
  CONSTRAINT tb_veiculo_pkey PRIMARY KEY (id_veiculo),
  CONSTRAINT tb_veiculo_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.tb_cli(id_cliente)
);
CREATE TABLE public.oficinas (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nome character varying NOT NULL,
  cnpj character varying NOT NULL UNIQUE,
  email character varying UNIQUE,
  telefone character varying NOT NULL,
  cep character varying NOT NULL,
  logradouro character varying NOT NULL,
  numero character varying NOT NULL,
  bairro character varying NOT NULL,
  cidade character varying NOT NULL,
  estado character NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT oficinas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ordens_servico (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  oficina_id bigint NOT NULL,
  cliente_id bigint NOT NULL,
  veiculo_id bigint NOT NULL,
  status text DEFAULT 'aguardando'::text CHECK (status = ANY (ARRAY['aguardando'::text, 'em_analise'::text, 'em_manutencao'::text, 'pronto'::text, 'entregue'::text])),
  descricao_problema text,
  data_entrada timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  data_saida timestamp with time zone,
  CONSTRAINT ordens_servico_pkey PRIMARY KEY (id),
  CONSTRAINT ordens_servico_oficina_id_fkey FOREIGN KEY (oficina_id) REFERENCES public.oficinas(id),
  CONSTRAINT ordens_servico_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.tb_cli(id_cliente),
  CONSTRAINT ordens_servico_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES public.tb_veiculo(id_veiculo)
);
CREATE TABLE public.avaliacoes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  os_id bigint NOT NULL UNIQUE,
  nota integer NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT avaliacoes_pkey PRIMARY KEY (id),
  CONSTRAINT avaliacoes_os_id_fkey FOREIGN KEY (os_id) REFERENCES public.ordens_servico(id)
);