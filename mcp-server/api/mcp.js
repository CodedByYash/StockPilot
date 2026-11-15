// Vercel function entry. Plain JS: the TypeScript is compiled by
// `npm run build` (tsc -> dist/), so Vercel never compiles TS itself.
export { default } from "../dist/http.js";
