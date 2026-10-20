// The directory listing types, exactly as the live WordPress plugin (v1.7.6)
// defines them. `key` is the stored directoryType; `url` is the path segment the
// live site uses (/directory/{url}/ and /directory/{url}/{id}/{slug}). The
// stallion list is also the directory's home page (/directory/).
export const DIRECTORY_TYPES = [
  { key: 'stallion', url: 'stallion', singular: 'Stallion', plural: 'Stallions', org_label: 'Stud', supports_gait: true },
  { key: 'trainer', url: 'trainer', singular: 'Trainer', plural: 'Trainers', org_label: 'Stable', supports_gait: false },
  { key: 'driver', url: 'driver', singular: 'Driver', plural: 'Drivers', org_label: 'Based At', supports_gait: false },
  { key: 'agistment', url: 'agistment', singular: 'Agistment', plural: 'Agistment', org_label: 'Operator', supports_gait: false },
  { key: 'transport', url: 'transport', singular: 'Equine Transport', plural: 'Equine Transport', org_label: 'Service Area', supports_gait: false },
  { key: 'vet', url: 'vet', singular: 'Veterinary Service', plural: 'Veterinary Services', org_label: 'Specialty', supports_gait: false },
  { key: 'feed_supplements', url: 'feed-supplements', singular: 'Feed & Supplements', plural: 'Feed & Supplements', org_label: 'Brand', supports_gait: false },
  { key: 'bloodstock', url: 'bloodstock', singular: 'Bloodstock Service', plural: 'Bloodstock Services', org_label: 'Specialty', supports_gait: false },
  { key: 'syndicator', url: 'syndicator', singular: 'Syndicator', plural: 'Syndicators & Ownership Groups', org_label: 'Manager', supports_gait: false },
  { key: 'pre_training', url: 'pre-training', singular: 'Breaking & Pre-Training', plural: 'Breaking & Pre-Training', org_label: 'Operator', supports_gait: false },
  { key: 'industry_service', url: 'industry-service', singular: 'Industry Service', plural: 'Equine Businesses & Industry Services', org_label: 'Service', supports_gait: false },
] as const;

export type DirectoryType = (typeof DIRECTORY_TYPES)[number];

export const byKey = (key: string) => DIRECTORY_TYPES.find((t) => t.key === key);
// "stallions" is the old (pre-1.2) segment; the live site still resolves it.
export const byUrl = (url: string) => DIRECTORY_TYPES.find((t) => t.url === (url === 'stallions' ? 'stallion' : url));
// WordPress stores the hyphenated slug ("feed-supplements"); Strapi enums use "_".
export const keyFromWordPress = (wpType: string) => (wpType || 'stallion').replace(/-/g, '_');
