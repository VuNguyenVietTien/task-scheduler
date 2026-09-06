// Validate every GraphQL operation in web/src/graphql/scheduling.ts against
// backend/schema.graphql: parses each document and runs full `validate`
// (argument/input/field types), NOT a name grep.
const fs = require('fs');
const path = require('path');
const { buildSchema, parse, validate, separateOperations } = require('graphql');

const root = path.resolve(__dirname, '..');
const sdl = fs.readFileSync(path.join(root, '../backend/schema.graphql'), 'utf8');
const src = fs.readFileSync(path.join(root, 'src/graphql/scheduling.ts'), 'utf8');

// Extract backtick gql blocks tagged gql`...`
const ops = [...src.matchAll(/gql`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1]);
if (ops.length === 0) { console.error('NO OPERATIONS FOUND'); process.exit(2); }

// Schema needs Query/Mutation roots for standalone build; strip SDL directives that need resolvers.
let schema;
try {
  schema = buildSchema(sdl);
} catch (e) {
  console.error('SCHEMA BUILD FAILED:', e.message); process.exit(2);
}

let failed = 0;
for (const doc of ops) {
  let parsed;
  try { parsed = parse(doc); } catch (e) {
    console.error('PARSE FAIL:', e.message.slice(0, 200)); failed++; continue;
  }
  const separated = separateOperations(parsed);
  for (const [name, op] of Object.entries(separated)) {
    const errs = validate(schema, op);
    if (errs.length) {
      failed++;
      console.error(`FAIL ${name}:`);
      for (const e of errs) console.error('   ', e.message.slice(0, 220));
    } else {
      console.log(`PASS ${name}`);
    }
  }
}
console.log(failed === 0 ? 'ALL OPERATIONS VALID' : `${failed} OPERATIONS FAILED`);
process.exit(failed === 0 ? 0 : 1);
