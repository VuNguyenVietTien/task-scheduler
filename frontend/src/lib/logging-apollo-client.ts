import { ApolloClient, NormalizedCacheObject } from '@apollo/client';

// Hàm logger đơn giản để ghi log GraphQL
export const setupGraphQLLogging = (client: ApolloClient<NormalizedCacheObject>) => {
  const originalQuery = client.query.bind(client);
  const originalMutate = client.mutate.bind(client);

  // Ghi đè phương thức query
  client.query = async function(...args) {
    const options = args[0];
    const query = options.query.loc?.source.body || '';
    const variables = options.variables || {};
    
    console.log('\n=== GraphQL Query ===');
    console.log('Query:');
    console.log(`${query}`);
    console.log('Variables:', JSON.stringify(variables, null, 2));
    
    const startTime = performance.now();
    try {
      const result = await originalQuery(...args);
      const duration = performance.now() - startTime;
      
      console.log('\n=== GraphQL Response ===');
      console.log(`Duration: ${duration.toFixed(2)}ms`);
      console.log('Response:', JSON.stringify({
        data: result.data,
        hasErrors: result.errors && result.errors.length > 0
      }, null, 2));
      console.log('======================\n');
      
      return result;
    } catch (error) {
      console.log('\n=== GraphQL Error ===');
      console.error(error);
      console.log('======================\n');
      throw error;
    }
  };

  // Ghi đè phương thức mutate
  client.mutate = async function(...args) {
    const options = args[0];
    const mutation = options.mutation.loc?.source.body || '';
    const variables = options.variables || {};
    
    console.log('\n=== GraphQL Mutation ===');
    console.log('Mutation:');
    console.log(`${mutation}`);
    console.log('Variables:', JSON.stringify(variables, null, 2));
    
    const startTime = performance.now();
    try {
      const result = await originalMutate(...args);
      const duration = performance.now() - startTime;
      
      console.log('\n=== GraphQL Response ===');
      console.log(`Duration: ${duration.toFixed(2)}ms`);
      console.log('Response:', JSON.stringify({
        data: result.data,
        hasErrors: result.errors && result.errors.length > 0
      }, null, 2));
      console.log('======================\n');
      
      return result;
    } catch (error) {
      console.log('\n=== GraphQL Error ===');
      console.error(error);
      console.log('======================\n');
      throw error;
    }
  };

  return client;
}; 