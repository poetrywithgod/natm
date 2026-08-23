-- Change Form 2's immutability trigger: it previously locked the row the
-- moment submitted_at was set (same behavior as Form 1's lock-on-submit).
-- Correct intended flow: Form 2 stays editable across multiple saves/
-- resubmissions until the AI recommendation has actually been generated
-- for the episode -- only then does further editing get rejected.
--
-- Form 1's lock-on-submit trigger (prevent_edit_after_submission, used by
-- form1_lock_after_submit) is untouched -- that's a separate, earlier gate
-- unrelated to AI timing.

drop trigger if exists form2_lock_after_submit on form2_submissions;

create or replace function prevent_form2_edit_after_ai_recommendation() returns trigger as $$
declare
  episode_status text;
begin
  select status into episode_status
  from assessment_episodes
  where id = old.episode_id;

  if episode_status in ('ai_suggested', 'completed') then
    raise exception 'This submission is locked because the AI recommendation has already been generated for this episode.';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger form2_lock_after_ai_recommendation
  before update on form2_submissions
  for each row execute function prevent_form2_edit_after_ai_recommendation();
