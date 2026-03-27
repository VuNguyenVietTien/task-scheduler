import { mergeResolvers } from '@graphql-tools/merge';
import { projectResolvers } from './project';
import { taskResolvers } from './task';
import { userResolvers } from './user';
import { commentResolvers } from './comment';
import { notificationResolvers } from './notification';
import { planResolvers } from './plan';
import { systemResolvers } from './system';
import { moduleResolvers } from './module';
import { documentResolvers } from './document';
import { screenResolvers } from './screen';
import { componentResolvers } from './component';
import { flowResolvers } from './flow';
import { tagResolvers } from './tag';
import { externalLinkResolvers } from './external-link';

export const resolvers = mergeResolvers([
  projectResolvers,
  taskResolvers,
  userResolvers,
  commentResolvers,
  notificationResolvers,
  planResolvers,
  systemResolvers,
  moduleResolvers,
  documentResolvers,
  screenResolvers,
  componentResolvers,
  flowResolvers,
  tagResolvers,
  externalLinkResolvers,
]);
