-- Conservative backfill for dashboard display (only where NULL)
UPDATE public.change_events
SET revenue_surface = 'SUBSCRIPTION'
WHERE revenue_surface IS NULL;

UPDATE public.change_events
SET estimated_mrr_affected = 0
WHERE estimated_mrr_affected IS NULL;

UPDATE public.change_events
SET percent_customer_base_affected = 0
WHERE percent_customer_base_affected IS NULL;
