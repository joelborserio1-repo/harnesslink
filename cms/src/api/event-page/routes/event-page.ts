import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::event-page.event-page', { only: ['find', 'findOne'] });
