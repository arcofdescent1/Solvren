// Runs only inside the disposable GitHub lab. No managed-provider credentials.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash,createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import pg from 'pg';
assert.equal(process.env.SOLVREN_DISPOSABLE_RECOVERY_LAB,'true');
const mode=process.argv[2];
assert.ok(['seed','restore'].includes(mode));
const config=JSON.parse(await readFile('lab-status.json','utf8'));
const endpoint=new URL(config.API_URL);
assert.ok(['127.0.0.1','localhost'].includes(endpoint.hostname));
const dbUrl=new URL(config.DB_URL);assert.ok(['127.0.0.1','localhost'].includes(dbUrl.hostname));
const api=()=>createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const db=new pg.Client({connectionString:config.DB_URL});await db.connect();
const hash=b=>createHash('sha256').update(b).digest('hex');
function totp(secret){let bits='';for(const char of secret.replaceAll('=','').toUpperCase())bits+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char).toString(2).padStart(5,'0');const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const digest=createHmac('sha1',Buffer.from(bytes)).update(counter).digest();return ((digest.readUInt32BE(digest[19]&15)&0x7fffffff)%1000000).toString().padStart(6,'0');}
try{
 if(mode==='seed'){
  const password=randomBytes(32).toString('base64url'),email=`restore-${randomUUID()}@example.invalid`;
  const made=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.equal(made.error,null);
  const signed=api();assert.equal((await signed.auth.signInWithPassword({email,password})).error,null);
  const factor=await signed.auth.mfa.enroll({factorType:'totp',friendlyName:'Synthetic recovery lab'});assert.equal(factor.error,null);
  assert.equal((await signed.auth.mfa.challengeAndVerify({factorId:factor.data.id,code:totp(factor.data.totp.secret)})).error,null);
  assert.equal((await signed.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
  assert.equal((await admin.storage.createBucket('recovery-private',{public:false})).error,null);
  const bytes=Buffer.from('synthetic,private,restore\n001,test,only\n');
  assert.equal((await admin.storage.from('recovery-private').upload('source.csv',bytes)).error,null);
  await db.query(`create table public.recovery_fixture(owner_id uuid references auth.users(id),value text);alter table public.recovery_fixture enable row level security;grant select on public.recovery_fixture to authenticated;create policy own on public.recovery_fixture for select to authenticated using(owner_id=auth.uid());`);
  await db.query('insert into public.recovery_fixture values($1,$2)',[made.data.user.id,'synthetic-only']);
  // Export provider-owned identity rows, preserving real password and TOTP state.
  const tables=(await db.query("select tablename from pg_tables where schemaname='auth' and tablename not in ('schema_migrations') order by tablename")).rows;
  const args=['exec','supabase_db_solvren-synthetic-recovery','pg_dump','-U','postgres','-d','postgres','--format=custom','--data-only','--no-owner','--no-acl'];
  for(const {tablename} of tables){assert.match(tablename,/^[a-z_]+$/);args.push('--table=auth.'+tablename);}
  await writeFile('identity.dump',execFileSync('docker',args,{stdio:'pipe'}));
  await writeFile('application.dump',execFileSync('docker',['exec','supabase_db_solvren-synthetic-recovery','pg_dump','-U','postgres','-d','postgres','--format=custom','--no-owner','--no-acl','--table=public.recovery_fixture'],{stdio:'pipe'}));
  const downloaded=await admin.storage.from('recovery-private').download('source.csv');assert.equal(downloaded.error,null);
  const actual=Buffer.from(await downloaded.data.arrayBuffer());assert.equal(hash(actual),hash(bytes));
  await writeFile('object.bin',actual);
  await writeFile('recovery-fixture.json',JSON.stringify({email,password,user:made.data.user.id,factor:factor.data.id,secret:factor.data.totp.secret,sha256:hash(actual),createdAt:new Date().toISOString()}),{mode:0o600});
  console.log('PASS: real provider password/TOTP enrollment and private object captured. Synthetic-only fixture; no production credentials.');
 }else{
  const fixture=JSON.parse(await readFile('recovery-fixture.json','utf8'));
  assert.equal(Number((await db.query('select count(*) from auth.users')).rows[0].count),0,'Restore target must be empty');
  execFileSync('docker',['exec','-i','supabase_db_solvren-synthetic-recovery','pg_restore','-U','postgres','-d','postgres','--data-only','--no-owner','--no-acl','--disable-triggers','--exit-on-error'],{input:await readFile('identity.dump'),stdio:['pipe','pipe','pipe']});
  execFileSync('docker',['exec','-i','supabase_db_solvren-synthetic-recovery','pg_restore','-U','postgres','-d','postgres','--no-owner','--no-acl','--exit-on-error'],{input:await readFile('application.dump'),stdio:['pipe','pipe','pipe']});
  // Never carry authenticated sessions into a recovered environment.
  await db.query('delete from auth.refresh_tokens; delete from auth.sessions');
  assert.equal((await admin.storage.createBucket('recovery-private',{public:false})).error,null);
  const bytes=await readFile('object.bin');assert.equal(hash(bytes),fixture.sha256);
  assert.equal((await admin.storage.from('recovery-private').upload('source.csv',bytes)).error,null);
  const signed=api();assert.equal((await signed.auth.signInWithPassword({email:fixture.email,password:fixture.password})).error,null);
  assert.equal((await signed.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal1');
  const factors=await signed.auth.mfa.listFactors();assert.equal(factors.error,null);assert.ok(factors.data.totp.some(f=>f.id===fixture.factor));
  assert.equal((await signed.auth.mfa.challengeAndVerify({factorId:fixture.factor,code:totp(fixture.secret)})).error,null);
  assert.equal((await signed.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
  const visible=await signed.from('recovery_fixture').select('*');assert.equal(visible.error,null);assert.equal(visible.data.length,1);
  const other=await admin.auth.admin.createUser({email:`other-${randomUUID()}@example.invalid`,password:fixture.password,email_confirm:true});assert.equal(other.error,null);
  const outsider=api();assert.equal((await outsider.auth.signInWithPassword({email:other.data.user.email,password:fixture.password})).error,null);
  assert.deepEqual((await outsider.from('recovery_fixture').select('*')).data,[]);
  assert.ok((await outsider.storage.from('recovery-private').download('source.csv')).error);
  assert.ok((await api().storage.from('recovery-private').download('source.csv')).error);
  const restored=await admin.storage.from('recovery-private').download('source.csv');assert.equal(restored.error,null);assert.equal(hash(Buffer.from(await restored.data.arrayBuffer())),fixture.sha256);
  console.log('PASS: clean provider restore preserves password and MFA; fresh login starts AAL1, original TOTP reaches AAL2; outsider RLS/private-file denial and restored object hash pass.');
  console.log('SCOPE: provider primitive only. Full Solvren migrations, queue/financial reconciliation, deletion ledger, offsite ciphertext and independent key custody remain separate gates.');
 }
}catch(error){console.error('Recovery provider lab failed:',error.name);console.error((error.stack??'').split('\n').filter(line=>/^\s+at /.test(line)).join('\n'));process.exitCode=1;}
finally{await db.end();}
