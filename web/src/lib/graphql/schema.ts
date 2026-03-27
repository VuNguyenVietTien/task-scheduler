import { makeExecutableSchema } from '@graphql-tools/schema';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { taskSchedulerTypeDefs } from './types/task-scheduler';
import { designDocTypeDefs } from './types/design-doc';
import { resolvers } from './resolvers';

const typeDefs = mergeTypeDefs([taskSchedulerTypeDefs, designDocTypeDefs]);

export const schema = makeExecutableSchema({ typeDefs, resolvers });
