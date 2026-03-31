export const DB_NAME = 'glint-db';
export const DB_VERSION = 1;

export const STORES = {
  PROJECTS: 'projects',
  DEMOS: 'demos',
  ASSETS: 'assets',
  SETTINGS: 'settings',
};

export const INDEXES = {
  PROJECTS_BY_UPDATED: 'by_updated',
  PROJECTS_BY_TAG: 'by_tag',
  DEMOS_BY_PROJECT: 'by_project',
  DEMOS_BY_UPDATED: 'by_updated',
  DEMOS_BY_TAG: 'by_tag',
  ASSETS_BY_DEMO: 'by_demo',
};
