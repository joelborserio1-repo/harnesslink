import type { Schema, Struct } from '@strapi/strapi';

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
      'shared.legacy-image': SharedLegacyImage;
      'shared.seo': SharedSeo;
    }
  }
}
