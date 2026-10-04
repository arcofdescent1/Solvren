create function private.keep_frozen_report_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'frozen' then raise exception 'A frozen report cannot be changed'; end if;
  return new;
end;
$$;
create trigger keep_frozen_report_immutable before update on public.report_snapshots
for each row execute function private.keep_frozen_report_immutable();
