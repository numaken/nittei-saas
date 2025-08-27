export function buildICS({ uid, startUTC, endUTC, title, description, url, location } : {
  uid: string
  startUTC: string // YYYYMMDDTHHMMSSZ
  endUTC: string   // YYYYMMDDTHHMMSSZ
  title: string
  description?: string
  url?: string
  location?: string
}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//nittei-saas//JP',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${startUTC}`,
    `DTEND:${endUTC}`,
    `SUMMARY:${escapeText(title)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    url ? `URL:${url}` : null,
    location ? `LOCATION:${escapeText(location)}` : null,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean)
  return lines.join('\r\n')
}

function escapeText(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,|;|\r/g, '')
}
