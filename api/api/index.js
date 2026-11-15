// Vercel function entry. Plain JS on purpose: the TypeScript is compiled by
// `npm run build` (tsc -> dist/), so Vercel never has to compile TS itself.
const { handler } = require('../dist/vercel');
module.exports = handler;
