(function bootstrapTimezone() {
  const tzField = document.getElementById('timezone');
  if (tzField && Intl && Intl.DateTimeFormat) {
    tzField.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
})();
