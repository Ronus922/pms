/* ══════════════════════════════════════════════════════════
   SUPPLIERS MODULE — Full Schema
   ══════════════════════════════════════════════════════════ */

/* ── Main Table ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS suppliers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL,

  /* Identity */
  display_name         TEXT NOT NULL,
  company_name         TEXT NOT NULL DEFAULT '',
  contact_person       TEXT NOT NULL DEFAULT '',
  supplier_type        TEXT NOT NULL DEFAULT 'general',
  status               TEXT NOT NULL DEFAULT 'active',

  /* Contact */
  phone                TEXT NOT NULL DEFAULT '',
  mobile               TEXT NOT NULL DEFAULT '',
  email                TEXT NOT NULL DEFAULT '',
  website              TEXT NOT NULL DEFAULT '',
  address              TEXT NOT NULL DEFAULT '',
  city                 TEXT NOT NULL DEFAULT '',

  /* Financial */
  tax_id               TEXT NOT NULL DEFAULT '',
  bank_name            TEXT NOT NULL DEFAULT '',
  bank_branch          TEXT NOT NULL DEFAULT '',
  bank_account         TEXT NOT NULL DEFAULT '',
  payment_terms        TEXT NOT NULL DEFAULT 'net_30',

  /* Notes */
  notes                TEXT NOT NULL DEFAULT '',
  internal_notes       TEXT NOT NULL DEFAULT '',
  rating               INT,

  /* Metadata */
  created_by           UUID,
  created_by_name      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

/* Indexes */
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant
  ON suppliers (tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_status
  ON suppliers (tenant_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_type
  ON suppliers (tenant_id, supplier_type) WHERE deleted_at IS NULL;

/* Status constraint */
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'suppliers_status_check'
  ) THEN
    ALTER TABLE suppliers
      ADD CONSTRAINT suppliers_status_check
      CHECK (status IN ('active','inactive','archived'));
  END IF;
END $$;

/* Payment terms constraint */
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'suppliers_payment_terms_check'
  ) THEN
    ALTER TABLE suppliers
      ADD CONSTRAINT suppliers_payment_terms_check
      CHECK (payment_terms IN ('immediate','net_15','net_30','net_45','net_60','net_90','other'));
  END IF;
END $$;

/* Updated_at trigger */
CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

/* ── Documents Table ──────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS supplier_documents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL,
  supplier_id          UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  file_name            TEXT NOT NULL,
  file_url             TEXT NOT NULL,
  file_size_bytes      INT NOT NULL DEFAULT 0,
  mime_type            TEXT NOT NULL DEFAULT '',
  doc_type             TEXT NOT NULL DEFAULT 'general',
  uploaded_by          UUID,
  uploaded_by_name     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_docs_supplier
  ON supplier_documents (supplier_id);

/* ── Activity Log ─────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS supplier_activity_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL,
  supplier_id          UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  action_type          TEXT NOT NULL,
  changed_by           UUID,
  changed_by_name      TEXT,
  message              TEXT NOT NULL DEFAULT '',
  metadata_json        JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_activity_supplier
  ON supplier_activity_log (supplier_id);

/* Action type constraint */
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'supplier_activity_action_check'
  ) THEN
    ALTER TABLE supplier_activity_log
      ADD CONSTRAINT supplier_activity_action_check
      CHECK (action_type IN (
        'created','updated','document_uploaded','document_deleted',
        'status_changed','linked_to_task','linked_to_issue','archived','restored'
      ));
  END IF;
END $$;

/* ── Linkage Table (tasks, issues, areas) ─────────────────── */

CREATE TABLE IF NOT EXISTS supplier_links (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL,
  supplier_id          UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  link_type            TEXT NOT NULL,
  linked_entity_id     UUID NOT NULL,
  linked_entity_label  TEXT NOT NULL DEFAULT '',
  created_by           UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_links_supplier
  ON supplier_links (supplier_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'supplier_links_type_check'
  ) THEN
    ALTER TABLE supplier_links
      ADD CONSTRAINT supplier_links_type_check
      CHECK (link_type IN ('task','issue','area','property'));
  END IF;
END $$;
