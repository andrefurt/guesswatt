/**
 * GuessWatt - Calendar Utilities
 * 
 * Generate .ics files for calendar reminders.
 */

/**
 * Format date for ICS file.
 * 
 * @param {Date} date - Date to format
 * @returns {string} ICS formatted date (YYYYMMDD)
 */
function formatICSDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Format datetime for ICS file.
 * 
 * @param {Date} date - Date to format
 * @returns {string} ICS formatted datetime (YYYYMMDDTHHMMSS)
 */
function formatICSDateTime(date) {
  const dateStr = formatICSDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dateStr}T${hours}${minutes}00`;
}

/**
 * Generate a unique ID for the event.
 * 
 * @returns {string} Unique ID
 */
function generateUID() {
  return `guesswatt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@guesswatt.pt`;
}

/**
 * Create an ICS calendar file content.
 * 
 * @param {Object} options - Event options
 * @param {string} options.title - Event title
 * @param {string} options.description - Event description
 * @param {Date} options.date - Event date
 * @param {string} options.url - URL to include in event
 * @returns {string} ICS file content
 */
export function createICSEvent({ title, description, date, url }) {
  const now = new Date();
  const dateStr = formatICSDate(date);
  const timestamp = formatICSDateTime(now);
  
  // Escape special characters in text fields
  const escapeText = (text) => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };
  
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GuessWatt//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${generateUID()}`,
    `DTSTAMP:${timestamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateStr}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}${url ? `\\n\\n${url}` : ''}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-PT9H', // 9am on the day
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  
  return lines.join('\r\n');
}

/**
 * Download ICS file.
 * 
 * @param {string} content - ICS file content
 * @param {string} filename - Download filename
 */
export function downloadICS(content, filename = 'guesswatt-reminder.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Create and download a reminder to check prices again.
 * 
 * @param {number} monthsFromNow - How many months until reminder (default: 2)
 * @param {string} stateUrl - URL with current state for return visit
 */
export function createReminder(monthsFromNow = 2, stateUrl = null) {
  const reminderDate = new Date();
  reminderDate.setMonth(reminderDate.getMonth() + monthsFromNow);
  
  const description = [
    'Está na altura de verificar se há tarifas de eletricidade mais baratas.',
    '',
    'Demora menos de 1 minuto.',
    '',
    stateUrl ? `Volta aqui: ${stateUrl}` : 'Visita guesswatt.pt',
  ].join('\n');
  
  const icsContent = createICSEvent({
    title: '⚡ Verificar tarifa de eletricidade',
    description,
    date: reminderDate,
    url: stateUrl || 'https://guesswatt.pt',
  });
  
  downloadICS(icsContent);
}
