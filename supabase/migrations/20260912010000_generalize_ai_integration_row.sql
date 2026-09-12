-- The Anthropic-only connectivity check (test-anthropic-connection) is now
-- provider-agnostic (test-ai-connection, using _shared/ai-client.ts), so
-- the row it reports into needs a generic id/label instead of hardcoding
-- "anthropic". Existing notes are preserved via the id change (Postgres
-- allows updating a text primary key directly).
update system_integrations
set id = 'ai_provider',
    label = 'AI Provider (Intake Recommendations, Quiz Generation)',
    notes = notes || ' AI_PROVIDER can be switched to "gemini" (free, no card required) for testing while this is unresolved -- see _shared/ai-client.ts.'
where id = 'anthropic';
