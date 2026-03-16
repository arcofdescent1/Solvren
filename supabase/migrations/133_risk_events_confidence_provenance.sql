-- Gap 5: Risk event confidence and provenance fields for metric explainability.

alter table public.risk_events
  add column if not exists confidence_level text,
  add column if not exists detection_method text;

comment on column public.risk_events.confidence_level is 'Gap 5: HIGH | MEDIUM | LOW for exposure confidence';
comment on column public.risk_events.detection_method is 'Gap 5: e.g. issue_updated, config_change';

-- Existing rows: infer confidence from risk_score; detection_method can stay null.
update public.risk_events
set confidence_level = case
  when risk_score >= 80 then 'HIGH'
  when risk_score >= 50 then 'MEDIUM'
  else 'LOW'
end
where confidence_level is null;
