export const convertTo24Hour = (time12h) => {
  if (!time12h || typeof time12h !== 'string') return null;
  
  const [time, modifier] = time12h.trim().split(' ');
  if (!time || !modifier) return null;

  let [hours, minutes] = time.split(':');
  hours = parseInt(hours, 10);

  if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};

export const validateTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) return true;
  const start = convertTo24Hour(startTime);
  const end = convertTo24Hour(endTime);
  return start < end;
};

export const buildEventFilter = (hospitalId, { date, startDate, endDate, eventType, labelTag }) => {
  const filter = { hospital: hospitalId };

  if (date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    filter.date = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
  } else {
    const dateRange = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      dateRange.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateRange.$lte = end;
    }
    if (Object.keys(dateRange).length) filter.date = dateRange;
  }

  if (eventType) filter.eventType = eventType;
  if (labelTag) filter.labelTag = labelTag;

  return filter;
};
