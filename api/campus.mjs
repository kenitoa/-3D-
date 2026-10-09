import { createVercelHandler } from '../server/vercel.mjs';

export const config = { api: { bodyParser: false } };
export default createVercelHandler();
