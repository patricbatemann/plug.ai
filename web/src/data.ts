// The site the site screens show; the demo has one in view.
import { getSiteDetails } from './services/siteService';

const siteInfo = getSiteDetails();
export const SITE = {
  id: siteInfo.id,
  name: siteInfo.shortName,
  location: siteInfo.location,
  capacity: siteInfo.capacityMW,
};
