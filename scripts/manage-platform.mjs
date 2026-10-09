import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
import { CampusRepository, AsyncRepository, remoteClient, libsqlDatabase, passwordHash } from '../server/platform.mjs';

const command = process.argv[2];
const remote = Boolean(process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN);
const repository = remote ? new AsyncRepository(resolve('.'),libsqlDatabase(await remoteClient(process.env.TURSO_DATABASE_URL,process.env.TURSO_AUTH_TOKEN))) : new CampusRepository(resolve('.'), process.env.CAMPUS_DB_PATH);
const prompt = createInterface({ input: stdin, output: stdout });
async function hiddenPassword(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') throw new Error('Run account setup in an interactive terminal; passwords are never accepted in command arguments.');
  prompt.close(); stdout.write(label); stdin.setRawMode(true); stdin.resume();
  return new Promise((accept, reject) => {
    let value = '';
    const done = () => { stdin.setRawMode(false); stdin.removeListener('data', onData); stdin.pause(); stdout.write('\n'); };
    function onData(chunk) {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') { done(); accept(value); return; }
        if (char === '\u0003') { done(); reject(new Error('Setup cancelled.')); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0,-1);
        else if (char >= ' ' && value.length < 256) value += char;
      }
    }
    stdin.on('data', onData);
  });
}
try {
  if(remote)await repository.assertReady();
  if (command === 'create-user') {
    const username = await prompt.question('Username (3-64 ASCII letters/numbers/_.-): ');
    const role = await prompt.question('Role (admin/editor/reviewer): ');
    if (!['admin','editor','reviewer'].includes(role)) throw new Error('Choose an explicit role.');
    const campuses = await prompt.question('Campus IDs, comma separated (non-admin requires explicit scope): ');
    const password = await hiddenPassword('Password (12+ characters, hidden): ');
    const confirm = await hiddenPassword('Confirm password (hidden): ');
    if (password !== confirm) throw new Error('Passwords do not match.');
    const user = await repository.createUser(username.trim(), remote?passwordHash(password):password, role, campuses.split(',').map((id) => id.trim()).filter(Boolean));
    stdout.write(`Created ${user.role} account. Open ${remote?process.env.CAMPUS_PUBLIC_ORIGIN||'your production origin':`http://127.0.0.1:${process.env.PORT || 8765}`}/admin.html\n`);
  } else if (command === 'backup') {
    if(remote)throw new Error('Use the Turso database export/backup tools for an external database. Local backup is not a remote backup.');
    const destination = process.argv[3];
    if (!destination) throw new Error('Supply a new backup .sqlite path. Existing files will not be overwritten.');
    await repository.backup(destination); stdout.write('SQLite online backup completed.\n');
  } else if (command === 'disable-user') {
    const username = process.argv[3]; if (!username) throw new Error('Supply an existing username.');
    if(remote){
      await repository.transaction(async()=>{
        const row=await repository.db.prepare('SELECT id FROM users WHERE username=?').get(username);
        if(!row)throw new Error('Account not found.');
        await repository.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(row.id);
        await repository.db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);
        await repository.audit(null,'user.disabled',String(row.id),new Date().toISOString());
      });
    }else{
    repository.transaction(() => {
      const row=repository.db.prepare('SELECT id FROM users WHERE username=?').get(username);
      if(!row)throw new Error('Account not found.');
      repository.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(row.id);
      repository.db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);
      repository.audit(null,'user.disabled',String(row.id),new Date().toISOString());
    });
    }
    stdout.write('Account disabled and sessions revoked.\n');
  } else throw new Error('Commands: create-user | backup <new.sqlite> | disable-user <username>');
} finally { prompt.close(); repository.close(); }
