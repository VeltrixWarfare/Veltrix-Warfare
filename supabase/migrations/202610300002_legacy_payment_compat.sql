-- Compatibility patch for pre-existing payment_transactions tables.
-- Safe/additive: keeps old transaction rows while removing Midtrans-only requirements.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.payment_transactions'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%payment_method%'
        OR pg_get_constraintdef(oid) ILIKE '%snap_token%'
        OR pg_get_constraintdef(oid) ILIKE '%redirect_url%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.payment_transactions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS proof_path text,
  ADD COLUMN IF NOT EXISTS proof_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- These fields belong to the retired Midtrans flow and must not be required for QRIS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='snap_token') THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN snap_token DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='redirect_url') THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN redirect_url DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='gateway_response') THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN gateway_response DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.payment_transactions
  ALTER COLUMN payment_method SET DEFAULT 'manual_qris';

NOTIFY pgrst, 'reload schema';
