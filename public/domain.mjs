/** Shared, dependency-free rules. Stable keys do not change with UI language. */
export const STATUS = ['new', 'triage', 'scheduled', 'in_progress', 'waiting', 'complete', 'verified', 'closed'];
export const PRIORITY = ['emergency', 'urgent', 'normal', 'low', 'improvement'];
export const AIRTABLE_STATUS = Object.freeze(Object.fromEntries(STATUS.map((key, i) => [key,
  ['New / Nuevo','Triage / Revisión','Scheduled / Programado','In Progress / En proceso','Waiting / En espera','Complete / Terminado','Verified / Verificado','Closed / Cerrado'][i]])));
export const AIRTABLE_PRIORITY = Object.freeze(Object.fromEntries(PRIORITY.map((key, i) => [key,
  ['Emergency / Emergencia','Urgent / Urgente','Normal','Low / Baja','Improvement / Mejora'][i]])));
export function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const isOpen = ticket => !['complete', 'verified', 'closed'].includes(ticket.status);
export const label = (value, lang = 'en') => typeof value === 'object' && value !== null ? value[lang] ?? value.en ?? '' : String(value ?? '');
export function fullAddress(property) {
  return [property.street, property.neighborhood, [property.postalCode, property.city].filter(Boolean).join(' '), property.state, property.country].filter(Boolean).join(', ');
}
export function matches(value, search) { return normalize(value).includes(normalize(search).trim()); }
export function validateTicket(ticket, properties, areas) {
  const errors = [];
  if (!properties.some(p => p.id === ticket.propertyId)) errors.push('property');
  if (!String(ticket.title ?? '').trim() || String(ticket.title).length > 160) errors.push('title');
  if (String(ticket.description ?? '').length > 5000) errors.push('description');
  if (!PRIORITY.includes(ticket.priority)) errors.push('priority');
  if (ticket.areaId && !areas.some(a => a.id === ticket.areaId && a.propertyId === ticket.propertyId)) errors.push('area');
  return errors;
}
export function communication(ticket, property, lang = 'en') {
  const es = lang === 'es';
  return [property.name, fullAddress(property), '', `${es ? 'Reporte' : 'Ticket'}: ${ticket.code}`, label(ticket.title, lang),
    label(ticket.description, lang)].filter(v => v !== undefined).join('\n');
}
export function dateOnly(date = new Date(), timeZone = 'America/Mexico_City') {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date);
  const value = kind => parts.find(p => p.type === kind).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
