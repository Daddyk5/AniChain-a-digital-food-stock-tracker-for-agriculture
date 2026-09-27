/** Mints a long-lived service token for the scraper (role=ingest).
 *  Usage: npm run token -- [--sub scraper-davao] [--days 365] [--role ingest|admin] */
import { issueToken, type Role } from '../src/auth/jwt.ts';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]! : fallback;
};
const role = arg('role', 'ingest') as Role;
if (role !== 'ingest' && role !== 'admin') throw new Error('role must be ingest or admin');

const { token, expiresAt } = await issueToken(arg('sub', 'scraper'), role, Number(arg('days', '365')) * 86_400);
console.error(`role=${role} expires=${expiresAt}`);
console.log(token);
