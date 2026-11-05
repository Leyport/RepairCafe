// Where and when sessions are held. Sessions are on the third Saturday of each month
// (see RepairService.getThirdSaturday). Change these if the venue or times move.
export const VENUE = {
  name: 'United Reformed Church',
  address: 'Coleham Head, Shrewsbury',
  endHour: 14,
  times: '10am – 2pm',
  mapsQuery: 'United Reformed Church, Coleham Head, Shrewsbury',
};

export const VENUE_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(VENUE.mapsQuery);

// Shown on the privacy policy and data deletion pages. Check this is the right inbox.
export const CONTACT_EMAIL = 'admin@shrewsburyrepaircafe.org.uk';
export const ORGANISATION_NAME = 'Shrewsbury Repair Cafe';
