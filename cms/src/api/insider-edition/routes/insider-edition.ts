import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::insider-edition.insider-edition', { only: ['find', 'findOne'] });
