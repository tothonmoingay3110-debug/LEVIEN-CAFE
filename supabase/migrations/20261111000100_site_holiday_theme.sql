alter table public.site_content
  add column if not exists holiday_theme text not null default 'default';

alter table public.site_content
  drop constraint if exists site_content_holiday_theme_check;

alter table public.site_content
  add constraint site_content_holiday_theme_check
  check (holiday_theme in ('default', 'christmas', 'new-year', 'valentines', 'easter', 'independence-day', 'halloween', 'thanksgiving'));
