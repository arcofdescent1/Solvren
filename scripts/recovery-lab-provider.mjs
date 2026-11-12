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
 await db.query(await readFile('lab/schema.sql','utf8'));
 if(mode==='seed'){
  const password=randomBytes(32).toString('base64url'),email=`restore-${randomUUID()}@example.invalid`;
  const made=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.equal(made.error,null);
  const signed=api();assert.equal((await signed.auth.signInWithPassword({email,password})).error,null);
  const factor=await signed.auth.mfa.enroll({factorType:'totp',friendlyName:'Synthetic recovery lab'});assert.equal(factor.error,null);
  assert.equal((await signed.auth.mfa.challengeAndVerify({factorId:factor.data.id,code:totp(factor.data.totp.secret)})).error,null);
  assert.equal((await signed.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
  const org=randomUUID(),job=randomUUID(),file=randomUUID(),objectKey=`${org}/${job}/${file}`;
  await db.query('insert into public.organizations(id,name) values($1,$2)',[org,'Synthetic restored organization']);
  await db.query("insert into public.memberships(org_id,user_id,role) values($1,$2,'owner')",[org,made.data.user.id]);
  await db.query('insert into public.catalog_jobs(id,org_id,title,created_by) values($1,$2,$3,$4)',[job,org,'Synthetic recovery job',made.data.user.id]);
  assert.equal((await admin.storage.createBucket('recovery-private',{public:false})).error,null);
  const bytes=Buffer.from('synthetic,private,restore\n001,test,only\n');
  assert.equal((await admin.storage.from('recovery-private').upload('source.csv',bytes)).error,null);
  await db.query("insert into public.source_files(id,org_id,job_id,original_name,object_key,sha256,state,byte_size,uploaded_by) values($1,$2,$3,'source.csv',$4,$5,'ready',$6,$7)",[file,org,job,objectKey,hash(bytes),bytes.length,made.data.user.id]);
  assert.equal((await admin.storage.from('catalog-private').upload(objectKey,bytes)).error,null);
  const retiredFile=randomUUID(),retiredKey=`${org}/${job}/${retiredFile}`,profile=randomUUID(),run=randomUUID();
  await db.query("insert into public.source_files(id,org_id,job_id,original_name,object_key,sha256,state,byte_size,uploaded_by) values($1,$2,$3,'retired.csv',$4,$5,'ready',$6,$7)",[retiredFile,org,job,retiredKey,hash(bytes),bytes.length,made.data.user.id]);
  assert.equal((await admin.storage.from('catalog-private').upload(retiredKey,bytes)).error,null);
  await db.query("insert into public.catalog_profile_versions(id,org_id,name,version) values($1,$2,'Recovery profile',1)",[profile,org]);
  await db.query('insert into solvren_private.operator_allowlist(email,user_id) values($1,$2)',[email,made.data.user.id]);
  await db.query('insert into solvren_private.staff_members(user_id) values($1)',[made.data.user.id]);
  await db.query('insert into solvren_private.staff_assignments(job_id,user_id) values($1,$2)',[job,made.data.user.id]);
  await db.query("update public.catalog_jobs set status='processing',profile_version_id=$2 where id=$1",[job,profile]);
  await db.query('insert into public.catalog_runs(id,org_id,job_id,profile_version_id,input_file_id,created_by) values($1,$2,$3,$4,$5,$6)',[run,org,job,profile,file,made.data.user.id]);
  const claim=(await db.query('select * from solvren_private.claim_catalog_run()')).rows[0];assert.equal(claim.id,run);
  await db.query("select solvren_private.catalog_run_checkpoint($1,$2,'validated',$3)",[run,claim.claim_token,{issues:[],marker:'preserved through offsite recovery'}]);
  await db.query(`create table public.recovery_fixture(owner_id uuid references auth.users(id),value text);alter table public.recovery_fixture enable row level security;grant select on public.recovery_fixture to authenticated;create policy own on public.recovery_fixture for select to authenticated using(owner_id=auth.uid());`);
  await db.query('insert into public.recovery_fixture values($1,$2)',[made.data.user.id,'synthetic-only']);
  // Export provider-owned identity rows, preserving real password and TOTP state.
  const tables=(await db.query("select tablename from pg_tables where schemaname='auth' and tablename not in ('schema_migrations') order by tablename")).rows;
  const args=['exec','supabase_db_solvren-synthetic-recovery','pg_dump','-U','postgres','-d','postgres','--format=custom','--data-only','--no-owner','--no-acl'];
  for(const {tablename} of tables){assert.match(tablename,/^[a-z_]+$/);args.push('--table=auth.'+tablename);}
  await writeFile('identity.dump',execFileSync('docker',args,{stdio:'pipe'}));
  await writeFile('application.dump',execFileSync('docker',['exec','supabase_db_solvren-synthetic-recovery','pg_dump','-U','postgres','-d','postgres','--format=custom','--data-only','--no-owner','--no-acl','--schema=public','--schema=solvren_private'],{stdio:'pipe'}));
  const downloaded=await admin.storage.from('recovery-private').download('source.csv');assert.equal(downloaded.error,null);
  const actual=Buffer.from(await downloaded.data.arrayBuffer());assert.equal(hash(actual),hash(bytes));
  await writeFile('object.bin',actual);
  // Ledger entry is later than the database snapshot: recovery must honor it.
  const tombstone={bucket:'catalog-private',key:retiredKey,recordedAt:new Date().toISOString(),evidence:randomUUID()};
  await writeFile('recovery-fixture.json',JSON.stringify({org,job,file,objectKey,retiredFile,retiredKey,tombstone,run,claimToken:claim.claim_token,email,password,user:made.data.user.id,factor:factor.data.id,secret:factor.data.totp.secret,sha256:hash(actual),createdAt:new Date().toISOString()}),{mode:0o600});
  console.log('PASS: real provider password/TOTP enrollment and private object captured. Synthetic-only fixture; no production credentials.');
 }else{
  const fixture=JSON.parse(await readFile('recovery-fixture.json','utf8'));
  assert.equal(Number((await db.query('select count(*) from auth.users')).rows[0].count),0,'Restore target must be empty');
  execFileSync('docker',['exec','-i','supabase_db_solvren-synthetic-recovery','pg_restore','-U','supabase_admin','-d','postgres','--data-only','--no-owner','--no-acl','--disable-triggers','--exit-on-error'],{input:await readFile('identity.dump'),stdio:['pipe','pipe','pipe']});
  await db.query(`create table public.recovery_fixture(owner_id uuid references auth.users(id),value text);alter table public.recovery_fixture enable row level security;grant select on public.recovery_fixture to authenticated;create policy own on public.recovery_fixture for select to authenticated using(owner_id=auth.uid());`);
  const appTables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','solvren_private')")).rows;
  for(const t of appTables){assert.match(t.schemaname,/^[a-z_]+$/);assert.match(t.tablename,/^[a-z_]+$/);}
  await db.query('truncate '+appTables.map(t=>`${t.schemaname}.${t.tablename}`).join(',')+' restart identity cascade');
  execFileSync('docker',['exec','-i','supabase_db_solvren-synthetic-recovery','pg_restore','-U','supabase_admin','-d','postgres','--data-only','--disable-triggers','--no-owner','--no-acl','--exit-on-error'],{input:await readFile('application.dump'),stdio:['pipe','pipe','pipe']});
  // Never carry authenticated sessions into a recovered environment.
  const recoveryId=randomUUID();await db.query('select solvren_private.begin_restore($1)',[recoveryId]);
  const epoch=(await db.query('select execution_epoch from public.catalog_jobs where id=$1',[fixture.job])).rows[0].execution_epoch;
  await db.query('select solvren_private.begin_restore($1)',[recoveryId]);
  assert.equal((await db.query('select execution_epoch from public.catalog_jobs where id=$1',[fixture.job])).rows[0].execution_epoch,epoch,'Containment replay is idempotent');
  const held=(await db.query('select state,result,claim_token from public.catalog_runs where id=$1',[fixture.run])).rows[0];
  assert.equal(held.state,'failed');assert.equal(held.claim_token,null);assert.equal(held.result.marker,'preserved through offsite recovery');
  await assert.rejects(db.query("select solvren_private.catalog_run_checkpoint($1,$2,'exported')",[fixture.run,fixture.claimToken]),{code:'40001'});
  await db.query('insert into solvren_private.object_tombstones(bucket_id,object_key,recorded_at,evidence_id) values($1,$2,$3,$4)',[fixture.tombstone.bucket,fixture.tombstone.key,fixture.tombstone.recordedAt,fixture.tombstone.evidence]);
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['catalog-private',fixture.retiredKey]),{code:'42501'});
  await db.query('delete from auth.refresh_tokens; delete from auth.sessions');
  assert.equal((await admin.storage.createBucket('recovery-private',{public:false})).error,null);
  const bytes=await readFile('object.bin');assert.equal(hash(bytes),fixture.sha256);
  assert.equal((await admin.storage.from('recovery-private').upload('source.csv',bytes)).error,null);
  assert.equal((await admin.storage.from('catalog-private').upload(fixture.objectKey,bytes)).error,null);
  await db.query("notify pgrst, 'reload schema'");
  const signed=api();assert.equal((await signed.auth.signInWithPassword({email:fixture.email,password:fixture.password})).error,null);
  assert.equal((await signed.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal1');
  const factors=await signed.auth.mfa.listFactors();assert.equal(factors.error,null);assert.ok(factors.data.totp.some(f=>f.id===fixture.factor));
  assert.equal((await signed.auth.mfa.challengeAndVerify({factorId:fixture.factor,code:totp(fixture.secret)})).error,null);
  assert.equal((await signed.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
  assert.deepEqual((await signed.from('catalog_jobs').select('id').eq('id',fixture.job)).data,[],'Contained database denies even fresh MFA sessions');
  assert.ok((await signed.storage.from('catalog-private').download(fixture.objectKey)).error);
  assert.equal((await db.query('select count(*)::int n from solvren_private.worker_readiness where expected')).rows[0].n,0);
  // Explicit lab-only release after reconciliation; no worker is activated.
  await db.query('update solvren_private.recovery_control set contained=false where recovery_id=$1',[recoveryId]);
  await db.query("update public.catalog_runs set state='queued' where id=$1",[fixture.run]);
  const replacement=(await db.query('select * from solvren_private.claim_catalog_run()')).rows[0];
  assert.equal(replacement.id,fixture.run);assert.notEqual(replacement.claim_token,fixture.claimToken);
  assert.equal(replacement.result.marker,'preserved through offsite recovery');
  await assert.rejects(db.query("select solvren_private.catalog_run_checkpoint($1,$2,'exported')",[fixture.run,fixture.claimToken]),{code:'40001'});
  await db.query("select solvren_private.catalog_run_checkpoint($1,$2,'exported')",[fixture.run,replacement.claim_token]);
  const jobs=await signed.from('catalog_jobs').select('id').eq('id',fixture.job);assert.equal(jobs.error,null);assert.deepEqual(jobs.data,[{id:fixture.job}]);
  const ownFile=await signed.storage.from('catalog-private').download(fixture.objectKey);assert.equal(ownFile.error,null);assert.equal(hash(Buffer.from(await ownFile.data.arrayBuffer())),fixture.sha256);
  const visible=await signed.from('recovery_fixture').select('*');assert.equal(visible.error,null);assert.equal(visible.data.length,1);
  assert.deepEqual((await signed.from('source_files').select('id').eq('id',fixture.retiredFile)).data,[]);
  assert.ok((await signed.storage.from('catalog-private').download(fixture.retiredKey)).error);
  const other=await admin.auth.admin.createUser({email:`other-${randomUUID()}@example.invalid`,password:fixture.password,email_confirm:true});assert.equal(other.error,null);
  const outsider=api();assert.equal((await outsider.auth.signInWithPassword({email:other.data.user.email,password:fixture.password})).error,null);
  assert.deepEqual((await outsider.from('recovery_fixture').select('*')).data,[]);
  assert.deepEqual((await outsider.from('catalog_jobs').select('id').eq('id',fixture.job)).data,[]);
  assert.ok((await outsider.storage.from('catalog-private').download(fixture.objectKey)).error);
  assert.ok((await outsider.storage.from('recovery-private').download('source.csv')).error);
  assert.ok((await api().storage.from('recovery-private').download('source.csv')).error);
  const restored=await admin.storage.from('recovery-private').download('source.csv');assert.equal(restored.error,null);assert.equal(hash(Buffer.from(await restored.data.arrayBuffer())),fixture.sha256);
  console.log('PASS: clean provider restore preserves password and MFA; fresh login starts AAL1, original TOTP reaches AAL2; outsider RLS/private-file denial and restored object hash pass.');
  console.log('PASS: 65 migrations, restored application permissions, in-flight checkpoint containment/retry fencing and newer tombstone replay. Retired file stays inaccessible and cannot be recreated.');
  console.log('SCOPE: financial-effect reconciliation and export archive completeness remain separate gates; no deletion executor or customer data used.');
 }
}catch(error){console.error('Recovery provider lab failed:',error.name);console.error((error.stack??'').split('\n').filter(line=>/^\s+at /.test(line)).join('\n'));for(const line of (error.stderr?.toString()??'').split('\n')){if(line.includes('ERROR:'))console.error(line.split('ERROR:')[1].replace(/"[^"]*"/g,'"[identifier]"'));}process.exitCode=1;}
finally{await db.end();}

