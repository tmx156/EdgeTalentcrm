-- =====================================================
-- Migration: Update Package Prices (January 2026)
-- =====================================================
-- Updates main package prices to new values:
-- INTRO: £1199
-- SILVER: £3100
-- GOLD: £3600
-- PLATINUM: £4800
-- =====================================================

-- Update INTRO package price
UPDATE packages
SET price = 1199.00,
    updated_at = NOW()
WHERE code = 'intro';

-- Update SILVER package price
UPDATE packages
SET price = 3100.00,
    updated_at = NOW()
WHERE code = 'silver';

-- Update GOLD package price
UPDATE packages
SET price = 3600.00,
    updated_at = NOW()
WHERE code = 'gold';

-- Update PLATINUM package price
UPDATE packages
SET price = 4800.00,
    updated_at = NOW()
WHERE code = 'platinum';

-- Verify the updates
SELECT code, name, price FROM packages WHERE type = 'main' ORDER BY display_order;
