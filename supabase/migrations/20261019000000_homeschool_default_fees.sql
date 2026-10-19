-- ============================================================
-- Homeschool tenants, subscription rates
-- ============================================================
-- A homeschool family is a much smaller tenant than a school and should
-- pay a lower platform subscription. Super Admin keeps a separate default
-- Term 1/2/3 rate card for homeschool tenants; create-school pre-fills a new
-- homeschool tenant from these columns instead of the school defaults.
--
-- Null means "no homeschool default yet" and create-school then pre-fills
-- nothing for that term -- it deliberately does NOT fall back to the school
-- rates, so a family is never quietly put on a full school rate card. The
-- rate card stays editable per tenant afterwards, as before.
--
-- Additive: existing rows and existing schools are untouched.
-- ============================================================

alter table platform_settings
  add column if not exists homeschool_term_1_fee numeric(12,2),
  add column if not exists homeschool_term_2_fee numeric(12,2),
  add column if not exists homeschool_term_3_fee numeric(12,2);
