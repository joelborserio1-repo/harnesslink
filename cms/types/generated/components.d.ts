import type { Schema, Struct } from '@strapi/strapi';

export interface DirectoryBanner extends Struct.ComponentSchema {
  collectionName: 'components_directory_banner';
  info: {
    description: '';
    displayName: 'Listing banner';
  };
  attributes: {
    alt: Schema.Attribute.String;
    endsOn: Schema.Attribute.Date;
    image: Schema.Attribute.Media<'images'>;
    imageUrl: Schema.Attribute.String;
    startsOn: Schema.Attribute.Date;
    target: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface DirectoryContact extends Struct.ComponentSchema {
  collectionName: 'components_directory_contact';
  info: {
    description: 'Shown publicly only on paid listings.';
    displayName: 'Contact details';
  };
  attributes: {
    address: Schema.Attribute.Text;
    contactAu: Schema.Attribute.Text;
    contactFr: Schema.Attribute.Text;
    contactNz: Schema.Attribute.Text;
    contactOther: Schema.Attribute.Text;
    contactUs: Schema.Attribute.Text;
    email: Schema.Attribute.String;
    phone: Schema.Attribute.String;
    studWebsite: Schema.Attribute.String;
    website: Schema.Attribute.String;
  };
}

export interface DirectoryCross extends Struct.ComponentSchema {
  collectionName: 'components_directory_cross';
  info: {
    description: '';
    displayName: 'Cross of Gold';
  };
  attributes: {
    description: Schema.Attribute.Text;
    examples: Schema.Attribute.Text;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface DirectoryGalleryItem extends Struct.ComponentSchema {
  collectionName: 'components_directory_gallery_item';
  info: {
    description: '';
    displayName: 'Gallery item';
  };
  attributes: {
    caption: Schema.Attribute.String;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Media<'images'>;
    mediaType: Schema.Attribute.Enumeration<['image', 'video']> &
      Schema.Attribute.DefaultTo<'image'>;
    url: Schema.Attribute.String;
  };
}

export interface DirectoryPedigree extends Struct.ComponentSchema {
  collectionName: 'components_directory_pedigree';
  info: {
    description: "Sire/dam and up to 14 ancestors (s = sire, d = dam: ss = sire's sire \u2026).";
    displayName: 'Pedigree';
  };
  attributes: {
    dam: Schema.Attribute.String;
    dd: Schema.Attribute.String;
    ddd: Schema.Attribute.String;
    dds: Schema.Attribute.String;
    ds: Schema.Attribute.String;
    dsd: Schema.Attribute.String;
    dss: Schema.Attribute.String;
    sd: Schema.Attribute.String;
    sdd: Schema.Attribute.String;
    sds: Schema.Attribute.String;
    sire: Schema.Attribute.String;
    ss: Schema.Attribute.String;
    ssd: Schema.Attribute.String;
    sss: Schema.Attribute.String;
  };
}

export interface DirectoryProgeny extends Struct.ComponentSchema {
  collectionName: 'components_directory_progeny';
  info: {
    description: '';
    displayName: 'Progeny';
  };
  attributes: {
    broodmareSire: Schema.Attribute.String;
    country: Schema.Attribute.String;
    dam: Schema.Attribute.String;
    foalingDate: Schema.Attribute.String;
    mileRate: Schema.Attribute.String;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    prizemoney: Schema.Attribute.String;
    prizemoneyNum: Schema.Attribute.BigInteger;
    sex: Schema.Attribute.String;
    starts: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    wins: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface EventAssociate extends Struct.ComponentSchema {
  collectionName: 'components_event_associates';
  info: {
    description: "An official associate's logo and link";
    displayName: 'Associate';
    icon: 'handHeart';
  };
  attributes: {
    logo: Schema.Attribute.Media<'images'>;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    url: Schema.Attribute.String;
  };
}

export interface EventPrice extends Struct.ComponentSchema {
  collectionName: 'components_event_prices';
  info: {
    description: "A runner's win and place price (backup for when the TAB feed is unavailable)";
    displayName: 'Price';
    icon: 'chartBubble';
  };
  attributes: {
    place: Schema.Attribute.String;
    runner: Schema.Attribute.String & Schema.Attribute.Required;
    win: Schema.Attribute.String;
  };
}

export interface EventResult extends Struct.ComponentSchema {
  collectionName: 'components_event_results';
  info: {
    description: "One year's winner in the Previous winners table";
    displayName: 'Previous winner';
    icon: 'trophy';
  };
  attributes: {
    barrier: Schema.Attribute.String;
    driver: Schema.Attribute.String;
    odds: Schema.Attribute.String;
    replayUrl: Schema.Attribute.String;
    second: Schema.Attribute.String;
    slotHolder: Schema.Attribute.String;
    storyUrl: Schema.Attribute.String;
    third: Schema.Attribute.String;
    time: Schema.Attribute.String;
    trainer: Schema.Attribute.String;
    winner: Schema.Attribute.String & Schema.Attribute.Required;
    winnerPhoto: Schema.Attribute.Media<'images'>;
    winnerSilks: Schema.Attribute.Media<'images'>;
    year: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface EventSlotHolder extends Struct.ComponentSchema {
  collectionName: 'components_event_slot_holders';
  info: {
    description: "A slot holder, their silks and the runner they've chosen";
    displayName: 'Slot holder';
    icon: 'user';
  };
  attributes: {
    driver: Schema.Attribute.String;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    runner: Schema.Attribute.String;
    silks: Schema.Attribute.Media<'images'>;
    status: Schema.Attribute.Enumeration<
      ['to_be_announced', 'reported', 'confirmed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'to_be_announced'>;
    trainer: Schema.Attribute.String;
    website: Schema.Attribute.String;
  };
}

export interface SharedLegacyImage extends Struct.ComponentSchema {
  collectionName: 'components_shared_legacy_images';
  info: {
    description: 'An image still served from the old WordPress uploads';
    displayName: 'Legacy image';
    icon: 'picture';
  };
  attributes: {
    alt: Schema.Attribute.Text;
    caption: Schema.Attribute.Text;
    credit: Schema.Attribute.Text;
    height: Schema.Attribute.Integer;
    legacyWpId: Schema.Attribute.BigInteger;
    url: Schema.Attribute.String & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: 'Search and social metadata (mirrors what Rank Math stored)';
    displayName: 'SEO';
    icon: 'search';
  };
  attributes: {
    canonicalUrl: Schema.Attribute.String;
    focusKeyword: Schema.Attribute.String;
    metaDescription: Schema.Attribute.Text;
    metaTitle: Schema.Attribute.String;
    ogDescription: Schema.Attribute.Text;
    ogTitle: Schema.Attribute.String;
    robots: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'index,follow'>;
    schemaType: Schema.Attribute.Enumeration<
      ['NewsArticle', 'Article', 'BlogPosting', 'WebPage']
    > &
      Schema.Attribute.DefaultTo<'NewsArticle'>;
    twitterDescription: Schema.Attribute.Text;
    twitterTitle: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'directory.banner': DirectoryBanner;
      'directory.contact': DirectoryContact;
      'directory.cross': DirectoryCross;
      'directory.gallery-item': DirectoryGalleryItem;
      'directory.pedigree': DirectoryPedigree;
      'directory.progeny': DirectoryProgeny;
      'event.associate': EventAssociate;
      'event.price': EventPrice;
      'event.result': EventResult;
      'event.slot-holder': EventSlotHolder;
      'shared.legacy-image': SharedLegacyImage;
      'shared.seo': SharedSeo;
    }
  }
}
