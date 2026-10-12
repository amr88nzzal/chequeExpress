import { migrate } from './migrate.ts';

const url = process.env['MIGRATION_DATABASE_URL'];
if (!url) {
  console.error('MIGRATION_DATABASE_URL is required (connect as the migrator role)');
  process.exit(1);
}
const applied = await migrate(url);
console.log(JSON.stringify({ msg: 'migrations applied', applied }));
