# Timezone Policy

## UTC Source Of Truth

Store and send real timestamps as UTC ISO values, for example:

```text
2026-05-31T10:15:30.818Z
```

The frontend converts these timestamps to the browser's local timezone when it
displays them. A user in the United States and a user in India therefore see
the same event in their own local time.

## Business Dates

Payroll periods, attendance dates, joining dates, advance dates, and salary
effective dates are calendar dates. They are stored as UTC midnight values and
displayed without timezone shifting. For example, `2026-05-31` remains May 31
in every country.

## Server Schedules

A background worker cannot infer a browser timezone. A SUPER_ADMIN selects the
organization timezone from the Settings tab. The saved IANA timezone controls
backend business dates, payroll cron, and cloud backup cron.

The Settings dropdown applies immediately through:

```text
PATCH /api/settings/timezone
```

The API stores the timezone in `SystemSetting`, updates the current process,
and publishes the change through Redis so other API and worker processes apply
the new business timezone immediately. Restart services from the navbar
notification afterward so cron registrations are recreated in the new
timezone.

`APP_TIMEZONE` is the startup fallback before the database setting is loaded:

```env
APP_TIMEZONE=America/New_York
```

Use `Asia/Kolkata`, `Europe/London`, or another IANA timezone when appropriate.
`PAYROLL_CRON_TIMEZONE` and `R2_BACKUP_CRON_TIMEZONE` are optional overrides.
Normally leave them blank so both cron jobs follow the Settings tab. Restart
API and worker services after changing the organization timezone.
