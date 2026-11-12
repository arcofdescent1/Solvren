// Runs only inside the disposable GitHub lab. No managed-provider credentials.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash,createHmac,createCipheriv,createDecipheriv} from 'node:crypto';
import JSZip from 'jszip';
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
  const revokedEmail=`revoked-${randomUUID()}@example.invalid`,revokedUser=await admin.auth.admin.createUser({email:revokedEmail,password,email_confirm:true});assert.equal(revokedUser.error,null);
  await db.query("insert into public.memberships(org_id,user_id,role) values($1,$2,'viewer')",[org,revokedUser.data.user.id]);
  await db.query('delete from public.memberships where org_id=$1 and user_id=$2',[org,revokedUser.data.user.id]);
  await db.query('insert into public.catalog_jobs(id,org_id,title,created_by) values($1,$2,$3,$4)',[job,org,'Synthetic recovery job',made.data.user.id]);
  assert.equal((await admin.storage.createBucket('recovery-private',{public:false})).error,null);
  const bytes=Buffer.from('synthetic,private,restore\n001,test,only\n');
  assert.equal((await admin.storage.from('recovery-private').upload('source.csv',bytes)).error,null);
  await db.query("insert into public.source_files(id,org_id,job_id,original_name,object_key,sha256,state,byte_size,uploaded_by) values($1,$2,$3,'source.csv',$4,$5,'ready',$6,$7)",[file,org,job,objectKey,hash(bytes),bytes.length,made.data.user.id]);
  assert.equal((await admin.storage.from('catalog-private').upload(objectKey,bytes)).error,null);
  const deliveryFile=randomUUID(),delivery=randomUUID(),deliveryKey=`${org}/${job}/${deliveryFile}`;
  await db.query("insert into public.source_files(id,org_id,job_id,original_name,object_key,sha256,state,byte_size,uploaded_by,purpose) values($1,$2,$3,'delivery.csv',$4,$5,'ready',$6,$7,'delivery')",[deliveryFile,org,job,deliveryKey,hash(bytes),bytes.length,made.data.user.id]);
  await db.query("insert into public.catalog_deliveries(id,org_id,job_id,version,file_id,notes,created_by) values($1,$2,$3,1,$4,'Synthetic released result',$5)",[delivery,org,job,deliveryFile,made.data.user.id]);
  await db.query("insert into public.delivery_decisions(delivery_id,decision,note,actor_id) values($1,'released','Synthetic release',$2)",[delivery,made.data.user.id]);
  assert.equal((await admin.storage.from('catalog-private').upload(deliveryKey,bytes)).error,null);
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
  const request=randomUUID(),part=randomUUID(),archiveKey=`${request}/${part}.bin`,key=randomBytes(32),iv=randomBytes(12);
  const zip=new JSZip();zip.file('records/recovery.json',JSON.stringify({org,job,sourceSha256:hash(bytes)}));
  const plain=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  const cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
  const archive=Buffer.concat([Buffer.from('SLVX1'),iv,cipher.getAuthTag(),encrypted]);
  await db.query("insert into public.catalog_data_requests(id,org_id,requested_by,kind,status,completed_at) values($1,$2,$3,'organization_export','completed',now())",[request,org,made.data.user.id]);
  await db.query("insert into solvren_private.organization_export_parts(id,request_id,ordinal,kind,payload,object_key,status,sha256,byte_size,encryption_key) values($1,$2,1,'records','{}',$3,'ready',$4,$5,$6)",[part,request,archiveKey,hash(plain),plain.length,key]);
  assert.equal((await admin.storage.from('catalog-exports').upload(archiveKey,archive,{contentType:'application/octet-stream'})).error,null);
  const event=randomUUID(),notice=randomUUID(),order=randomUUID(),refund=randomUUID();
  await db.query("insert into public.job_events(id,org_id,job_id,actor_id,event_type,revision) values($1,$2,$3,$4,'recovery_fixture',0)",[event,org,job,made.data.user.id]);
  await db.query("insert into solvren_private.notification_outbox(id,event_id,recipient_id,job_id,subject,body,state,claim_token) values($1,$2,$3,$4,'Synthetic','Synthetic','sending',$5)",[notice,event,made.data.user.id,job,randomUUID()]);
  await db.query("insert into public.billing_orders(id,org_id,requested_by,amount_cents,status,stripe_payment_intent) values($1,$2,$3,100,'paid','pi_synthetic_recovery_only')",[order,org,made.data.user.id]);
  await db.query("insert into public.billing_refunds(id,order_id,amount_cents,reason,requested_by) values($1,$2,25,'Synthetic recovery',$3)",[refund,order,made.data.user.id]);
  await db.query(`create table public.recovery_fixture(owner_id uuid references auth.users(id),value text);alter table public.recovery_fixture enable row level security;grant select on public.recovery_fixture to authenticated;create policy own on public.recovery_fixture for select to authenticated using(owner_id=auth.uid());`);
  await db.query('insert into public.recovery_fixture values($1,$2)',[made.data.user.id,'synthetic-only']);
  // Export provider-owned identity rows, preserving real password and TOTP state.
  const tables=(await db.query("select tablename from pg_tables where schemaname='auth' and tablename not in ('schema_migrations') order by tablename")).rows;
  const args=['exec','supabase_db_solvren-synthetic-recovery','pg_dump','-U','postgres','-d','postgres','--format=custom','--data-only','--no-owner','--no-acl'];
  for(const {tablename} of tables){assert.match(tablename,/^[a-z_]+$/);args.push('--table=auth.'+tablename);}
  await writeFile('identity.dump',execFileSync('docker',args,{stdio:'pipe'}));
  await writeFile('application.dump',execFileSync('docker',['exec','supabase_db_solvren-synthetic-recovery','pg_dump','-U','postgres','-d','postgres','--format=custom','--data-only','--no-owner','--no-acl','--schema=public','--schema=solvren_private'],{stdio:'pipe'}));
  const counts={};for(const {schemaname,tablename} of (await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','solvren_private')")).rows){
   assert.match(schemaname,/^[a-z_]+$/);assert.match(tablename,/^[a-z_]+$/);
   counts[`${schemaname}.${tablename}`]=(await db.query(`select count(*)::int n from ${schemaname}.${tablename}`)).rows[0].n;
  }
  const dumpHashes={identity:hash(await readFile('identity.dump')),application:hash(await readFile('application.dump'))};
  const downloaded=await admin.storage.from('recovery-private').download('source.csv');assert.equal(downloaded.error,null);
  const actual=Buffer.from(await downloaded.data.arrayBuffer());assert.equal(hash(actual),hash(bytes));
  await writeFile('object.bin',actual);
  // Ledger entry is later than the database snapshot: recovery must honor it.
  const tombstone={bucket:'catalog-private',key:retiredKey,recordedAt:new Date().toISOString(),evidence:randomUUID()};
  await writeFile('recovery-fixture.json',JSON.stringify({counts,dumpHashes,revokedEmail,delivery,deliveryKey,oldAccessToken:(await signed.auth.getSession()).data.session.access_token,org,job,file,objectKey,retiredFile,retiredKey,tombstone,run,notice,refund,claimToken:claim.claim_token,export:{request,part,key:archiveKey,bytes:archive.toString('base64'),sha256:hash(archive)},email,password,user:made.data.user.id,factor:factor.data.id,secret:factor.data.totp.secret,sha256:hash(actual),createdAt:new Date().toISOString()}),{mode:0o600});
  console.log('PASS: real provider password/TOTP enrollment and private object captured. Synthetic-only fixture; no production credentials.');
 }else{
  const fixture=JSON.parse(await readFile('recovery-fixture.json','utf8'));
  const verifyDump=(bytes,expected)=>assert.equal(hash(bytes),expected,'Restore dump digest mismatch');
  verifyDump(await readFile('identity.dump'),fixture.dumpHashes.identity);verifyDump(await readFile('application.dump'),fixture.dumpHashes.application);
  const corrupt=Buffer.from(await readFile('application.dump'));corrupt[corrupt.length-1]^=1;assert.throws(()=>verifyDump(corrupt,fixture.dumpHashes.application));
  assert.equal(Number((await db.query('select count(*) from auth.users')).rows[0].count),0,'Restore target must be empty');
  execFileSync('docker',['exec','-i','supabase_db_solvren-synthetic-recovery','pg_restore','-U','supabase_admin','-d','postgres','--data-only','--no-owner','--no-acl','--disable-triggers','--exit-on-error'],{input:await readFile('identity.dump'),stdio:['pipe','pipe','pipe']});
  await db.query(`create table public.recovery_fixture(owner_id uuid references auth.users(id),value text);alter table public.recovery_fixture enable row level security;grant select on public.recovery_fixture to authenticated;create policy own on public.recovery_fixture for select to authenticated using(owner_id=auth.uid());`);
  const appTables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','solvren_private')")).rows;
  for(const t of appTables){assert.match(t.schemaname,/^[a-z_]+$/);assert.match(t.tablename,/^[a-z_]+$/);}
  await db.query('truncate '+appTables.map(t=>`${t.schemaname}.${t.tablename}`).join(',')+' restart identity cascade');
  execFileSync('docker',['exec','-i','supabase_db_solvren-synthetic-recovery','pg_restore','-U','supabase_admin','-d','postgres','--data-only','--disable-triggers','--no-owner','--no-acl','--exit-on-error'],{input:await readFile('application.dump'),stdio:['pipe','pipe','pipe']});
  for(const [table,count] of Object.entries(fixture.counts)){assert.match(table,/^(public|solvren_private)\.[a-z_]+$/);assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n,count,`Restored row count: ${table}`);}
  // Never carry authenticated sessions into a recovered environment.
  const recoveryId=randomUUID();await db.query('select solvren_private.begin_restore($1)',[recoveryId]);
  const epoch=(await db.query('select execution_epoch from public.catalog_jobs where id=$1',[fixture.job])).rows[0].execution_epoch;
  await db.query('select solvren_private.begin_restore($1)',[recoveryId]);
  assert.equal((await db.query('select execution_epoch from public.catalog_jobs where id=$1',[fixture.job])).rows[0].execution_epoch,epoch,'Containment replay is idempotent');
  const held=(await db.query('select state,result,claim_token from public.catalog_runs where id=$1',[fixture.run])).rows[0];
  assert.equal(held.state,'failed');assert.equal(held.claim_token,null);assert.equal(held.result.marker,'preserved through offsite recovery');
  assert.deepEqual((await db.query('select state,claim_token from solvren_private.notification_outbox where id=$1',[fixture.notice])).rows[0],{state:'uncertain',claim_token:null});
  assert.equal((await db.query('select status from public.billing_refunds where id=$1',[fixture.refund])).rows[0].status,'uncertain');
  await assert.rejects(db.query("select solvren_private.catalog_run_checkpoint($1,$2,'exported')",[fixture.run,fixture.claimToken]),{code:'40001'});
  await db.query('insert into solvren_private.object_tombstones(bucket_id,object_key,recorded_at,evidence_id) values($1,$2,$3,$4)',[fixture.tombstone.bucket,fixture.tombstone.key,fixture.tombstone.recordedAt,fixture.tombstone.evidence]);
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['catalog-private',fixture.retiredKey]),{code:'42501'});
  await db.query('delete from auth.refresh_tokens; delete from auth.sessions');
  async function requireInventory(){
   const missing=(await db.query(`select f.object_key from public.source_files f where f.state='ready'
    and not exists(select 1 from solvren_private.object_tombstones t where t.bucket_id='catalog-private' and t.object_key=f.object_key)
    and not exists(select 1 from storage.objects o where o.bucket_id='catalog-private' and o.name=f.object_key)
    union all select p.object_key from solvren_private.organization_export_parts p where p.status='ready'
    and not exists(select 1 from solvren_private.object_tombstones t where t.bucket_id='catalog-exports' and t.object_key=p.object_key)
    and not exists(select 1 from storage.objects o where o.bucket_id='catalog-exports' and o.name=p.object_key)`)).rows;
   assert.equal(missing.length,0,'Ready source/export inventory incomplete');
  }
  await assert.rejects(requireInventory(),'Missing objects must prevent release');
  assert.equal((await admin.storage.createBucket('recovery-private',{public:false})).error,null);
  const bytes=await readFile('object.bin');assert.equal(hash(bytes),fixture.sha256);
  assert.equal((await admin.storage.from('recovery-private').upload('source.csv',bytes)).error,null);
  assert.equal((await admin.storage.from('catalog-private').upload(fixture.objectKey,bytes)).error,null);
  assert.equal((await admin.storage.from('catalog-private').upload(fixture.deliveryKey,bytes)).error,null);
  const archive=Buffer.from(fixture.export.bytes,'base64');assert.equal(hash(archive),fixture.export.sha256);
  const restoredPart=(await db.query('select * from solvren_private.organization_export_parts where id=$1',[fixture.export.part])).rows[0];
  const decrypt=(input,key)=>{assert.equal(input.subarray(0,5).toString(),'SLVX1');const d=createDecipheriv('aes-256-gcm',key,input.subarray(5,17));d.setAuthTag(input.subarray(17,33));return Buffer.concat([d.update(input.subarray(33)),d.final()]);};
  const plain=decrypt(archive,restoredPart.encryption_key);assert.equal(hash(plain),restoredPart.sha256);assert.equal(plain.length,Number(restoredPart.byte_size));
  const damaged=Buffer.from(archive);damaged[damaged.length-1]^=1;assert.throws(()=>decrypt(damaged,restoredPart.encryption_key));assert.throws(()=>decrypt(archive,randomBytes(32)));
  const contents=await JSZip.loadAsync(plain);assert.equal(JSON.parse(await contents.file('records/recovery.json').async('string')).sourceSha256,fixture.sha256);
  assert.equal((await admin.storage.from('catalog-exports').upload(fixture.export.key,archive,{contentType:'application/octet-stream'})).error,null);
  await requireInventory();
  await db.query("notify pgrst, 'reload schema'");
  const signed=api();assert.equal((await signed.auth.signInWithPassword({email:fixture.email,password:fixture.password})).error,null);
  assert.equal((await signed.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal1');
  const factors=await signed.auth.mfa.listFactors();assert.equal(factors.error,null);assert.ok(factors.data.totp.some(f=>f.id===fixture.factor));
  assert.equal((await signed.auth.mfa.challengeAndVerify({factorId:fixture.factor,code:totp(fixture.secret)})).error,null);
  assert.equal((await signed.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
  assert.deepEqual((await signed.from('catalog_jobs').select('id').eq('id',fixture.job)).data,[],'Contained database denies even fresh MFA sessions');
  assert.ok((await signed.storage.from('catalog-private').download(fixture.objectKey)).error);
  assert.ok((await signed.rpc('catalog_export_key',{part_id:fixture.export.part})).error,'Contained export key is denied');
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
  const oldSession=createClient(config.API_URL,config.ANON_KEY,{global:{headers:{Authorization:`Bearer ${fixture.oldAccessToken}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const staleRows=await oldSession.from('catalog_jobs').select('id');assert.ok(staleRows.error||staleRows.data.length===0,'Pre-restore session cannot regain access');
  const revoked=api();assert.equal((await revoked.auth.signInWithPassword({email:fixture.revokedEmail,password:fixture.password})).error,null);
  assert.deepEqual((await revoked.from('catalog_jobs').select('id').eq('id',fixture.job)).data,[]);
  assert.ok((await revoked.storage.from('catalog-private').download(fixture.deliveryKey)).error);
  const deliveryRows=await signed.from('catalog_deliveries').select('id').eq('id',fixture.delivery);assert.equal(deliveryRows.error,null);assert.deepEqual(deliveryRows.data,[{id:fixture.delivery}]);
  const deliveryBytes=await signed.storage.from('catalog-private').download(fixture.deliveryKey);assert.equal(deliveryBytes.error,null);assert.equal(hash(Buffer.from(await deliveryBytes.data.arrayBuffer())),fixture.sha256);
  const ownFile=await signed.storage.from('catalog-private').download(fixture.objectKey);assert.equal(ownFile.error,null);assert.equal(hash(Buffer.from(await ownFile.data.arrayBuffer())),fixture.sha256);
  const visible=await signed.from('recovery_fixture').select('*');assert.equal(visible.error,null);assert.equal(visible.data.length,1);
  assert.deepEqual((await signed.from('source_files').select('id').eq('id',fixture.retiredFile)).data,[]);
  assert.ok((await signed.storage.from('catalog-private').download(fixture.retiredKey)).error);
  const exportIndex=await signed.rpc('catalog_export_index',{request_id:fixture.export.request});assert.equal(exportIndex.error,null);assert.equal(exportIndex.data.parts.length,1);
  const exportKey=await signed.rpc('catalog_export_key',{part_id:fixture.export.part});assert.equal(exportKey.error,null);assert.equal(exportKey.data,restoredPart.encryption_key.toString('hex'));
  const ownerArchive=await signed.storage.from('catalog-exports').download(fixture.export.key);assert.equal(ownerArchive.error,null);assert.equal(hash(Buffer.from(await ownerArchive.data.arrayBuffer())),fixture.export.sha256);
  const other=await admin.auth.admin.createUser({email:`other-${randomUUID()}@example.invalid`,password:fixture.password,email_confirm:true});assert.equal(other.error,null);
  const outsider=api();assert.equal((await outsider.auth.signInWithPassword({email:other.data.user.email,password:fixture.password})).error,null);
  assert.deepEqual((await outsider.from('recovery_fixture').select('*')).data,[]);
  assert.deepEqual((await outsider.from('catalog_jobs').select('id').eq('id',fixture.job)).data,[]);
  assert.ok((await outsider.storage.from('catalog-private').download(fixture.objectKey)).error);
  assert.ok((await outsider.storage.from('catalog-exports').download(fixture.export.key)).error);
  assert.ok((await outsider.rpc('catalog_export_key',{part_id:fixture.export.part})).error);
  assert.ok((await outsider.storage.from('recovery-private').download('source.csv')).error);
  assert.ok((await api().storage.from('recovery-private').download('source.csv')).error);
  const restored=await admin.storage.from('recovery-private').download('source.csv');assert.equal(restored.error,null);assert.equal(hash(Buffer.from(await restored.data.arrayBuffer())),fixture.sha256);
  console.log('PASS: clean provider restore preserves password and MFA; fresh login starts AAL1, original TOTP reaches AAL2; outsider RLS/private-file denial and restored object hash pass.');
  console.log('PASS: 65 migrations, restored application permissions, in-flight checkpoint containment/retry fencing and newer tombstone replay. Retired file stays inaccessible and cannot be recreated.');
  console.log('PASS: encrypted ZIP export restored, DB-bound plaintext hash/size verified, wrong key/tamper rejected, owner download/key access restored and outsider denied.');
  console.log('PASS: every application table count matches; damaged dump and missing source/export inventory block recovery; sending notification and pending refund become uncertain without replay.');
  console.log('PASS: released delivery bytes/access restored; previously revoked member and pre-restore session remain denied.');
  console.log('SCOPE: synthetic provider recovery only; managed-provider configuration and production operating evidence are separate gates.');
 }
}catch(error){console.error('Recovery provider lab failed:',error.name);console.error((error.stack??'').split('\n').filter(line=>/^\s+at /.test(line)).join('\n'));for(const line of (error.stderr?.toString()??'').split('\n')){if(line.includes('ERROR:'))console.error(line.split('ERROR:')[1].replace(/"[^"]*"/g,'"[identifier]"'));}process.exitCode=1;}
finally{await db.end();}

