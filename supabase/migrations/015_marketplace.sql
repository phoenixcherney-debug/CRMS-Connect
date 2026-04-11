-- ============================================================
-- CRMS Connect — Marketplace
-- Run this in: Supabase Dashboard → Database → SQL Editor
-- ============================================================

-- ─── Table ──────────────────────────────────────────────────
CREATE TABLE marketplace_listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        UUID NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  price            NUMERIC(10,2),
  condition        TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
  category         TEXT NOT NULL DEFAULT 'Other',
  pickup_location  TEXT,
  photos           TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketplace_listings_seller_id_fkey
    FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- ─── updated_at trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION set_marketplace_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER marketplace_listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION set_marketplace_updated_at();

-- ─── Indexes ────────────────────────────────────────────────
CREATE INDEX idx_marketplace_seller_id    ON marketplace_listings(seller_id);
CREATE INDEX idx_marketplace_status_date  ON marketplace_listings(status, created_at DESC);
CREATE INDEX idx_marketplace_category     ON marketplace_listings(category);

-- ─── Row-Level Security ──────────────────────────────────────
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Authenticated users see only active listings (sold = invisible to everyone)
CREATE POLICY "marketplace_select_active"
  ON marketplace_listings FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Users insert only their own rows
CREATE POLICY "marketplace_insert_own"
  ON marketplace_listings FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());

-- Users update only their own rows
CREATE POLICY "marketplace_update_own"
  ON marketplace_listings FOR UPDATE
  TO authenticated
  USING  (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Users delete only their own rows
CREATE POLICY "marketplace_delete_own"
  ON marketplace_listings FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid());

-- ─── Storage bucket ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace-photos', 'marketplace-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can read any object in the bucket
CREATE POLICY "marketplace_photos_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'marketplace-photos');

-- Authenticated users can upload to their own folder (path[0] = their uid)
CREATE POLICY "marketplace_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete only their own uploads
CREATE POLICY "marketplace_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
