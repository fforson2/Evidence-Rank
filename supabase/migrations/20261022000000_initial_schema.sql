-- EvidenceRank initial schema.
-- The local demo does not connect to Supabase. Apply this when the team is
-- ready to persist posts, reviews, and experiment assignments.
--
-- The backend should use the service-role key, which bypasses row-level
-- security. Do not put that key in the frontend. No browser policies are granted.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- Embedding columns are intentionally omitted. The retrieval milestone can add
-- them once the evidence pipeline exists.

create table posts (
  id text primary key,
  type text not null check (type in ('text', 'video')),
  author text not null,
  content text not null,
  video_url text,
  likes integer not null default 0 check (likes >= 0),
  shares integer not null default 0 check (shares >= 0),
  evidence_status text not null check (
    evidence_status in (
      'supported',
      'missing_context',
      'source_mismatch',
      'contradicted',
      'unresolved',
      'not_checkable'
    )
  ),
  review_status text not null check (review_status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_video_url_matches_type check (
    (type = 'video' and video_url is not null)
    or (type = 'text' and video_url is null)
  )
);

create table claims (
  id text primary key,
  post_id text not null references posts (id) on delete cascade,
  claim_text text not null,
  evidence_status text not null check (
    evidence_status in (
      'supported',
      'missing_context',
      'source_mismatch',
      'contradicted',
      'unresolved',
      'not_checkable'
    )
  ),
  review_status text not null check (review_status in ('pending', 'approved')),
  explanation text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index claims_post_id_idx on claims (post_id);

create table evidence_sources (
  id text primary key,
  title text not null,
  url text not null,
  publisher text not null,
  created_at timestamptz not null default now()
);

create table claim_evidence (
  claim_id text not null references claims (id) on delete cascade,
  source_id text not null references evidence_sources (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (claim_id, source_id)
);

create index claim_evidence_source_id_idx on claim_evidence (source_id);

create table interaction_events (
  id uuid primary key default gen_random_uuid(),
  post_id text references posts (id) on delete set null,
  event_type text not null check (
    event_type in ('view', 'like', 'share', 'evidence_open', 'feed_mode_change')
  ),
  feed_mode text not null check (feed_mode in ('engagement', 'evidence')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index interaction_events_post_id_idx on interaction_events (post_id);
create index interaction_events_created_at_idx on interaction_events (created_at);

create table experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null unique,
  feed_mode text not null check (feed_mode in ('engagement', 'evidence')),
  assigned_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_set_updated_at
before update on posts
for each row
execute function set_updated_at();

create trigger claims_set_updated_at
before update on claims
for each row
execute function set_updated_at();

alter table posts enable row level security;
alter table claims enable row level security;
alter table evidence_sources enable row level security;
alter table claim_evidence enable row level security;
alter table interaction_events enable row level security;
alter table experiment_assignments enable row level security;
