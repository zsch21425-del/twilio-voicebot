(function bootstrap() {
  const tzField = document.getElementById('timezone');
  if (tzField && window.Intl && Intl.DateTimeFormat) {
    tzField.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  const form = document.querySelector('form.schedule-form');
  if (!form) return;

  form.addEventListener('submit', () => {
    const dt = form.querySelector('input[name="scheduledAt"]');
    if (!dt || !dt.value) return;

    const local = new Date(dt.value);
    if (Number.isNaN(local.getTime())) return;

    let hidden = form.querySelector('input[name="scheduledAtIso"]');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'scheduledAtIso';
      form.appendChild(hidden);
    }
    hidden.value = local.toISOString();
  });
})();
