import { docs, help } from '../.source/server';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

export const helpSource = loader({
  baseUrl: '/help',
  source: help.toFumadocsSource(),
});
