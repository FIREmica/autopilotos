import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {createConsultationRouter} from '../../src/storefront/consultationRouter';
import {approvedConsultationFacts,type ConsultationFact} from '../../src/storefront/consultationEvidence';
import {ConsultationProfessionalStage,stageAdmin} from './consultationProfessionalStage';

export function createProfessionalStage(file:string){
  const now=new Date('2026-11-21T04:00:00.000Z');
  let facts:readonly ConsultationFact[]=approvedConsultationFacts;
  const stage=new ConsultationProfessionalStage(file,()=>facts,()=>now);
  let notices=0;
  const app=express();
  // Deny-only staging boundary: inherited process variables can never enable live delivery or AI.
  app.use('/api/beauty/inquiries',(req,res,next)=>{
    if(req.method==='POST'&&/\/(approve-send|draft-ai|dispatch)$/.test(req.path))return res.status(409).json({error:'STAGING_NO_SEND',label:'SIMULADO',delivery_decision:'no_send'});
    next();
  });
  app.use('/api/beauty/inquiries',createConsultationRouter({
    store:stage.requests,administration:stage.administration,enabled:()=>true,
    origin:()=> 'https://victoriosas.online',abuseKey:()=> 'synthetic-staging-only',
    auth:(req,res,next)=>{if(req.get('authorization')!=='Bearer synthetic-stage-admin')return res.status(401).json({error:'ADMIN_AUTH_REQUIRED'});res.locals.adminUserId=stageAdmin;next();},
    reads:{list:async()=>({}),unreadCount:async()=>0,set:async()=>now.toISOString()},
    delivery:{ready:()=>true,send:async id=>{notices++;return 'SIMULADO:'+id;}},
    intelligence:{enabled:()=>true,store:stage.intelligence,provider:()=>undefined,now:()=>now,facts:async()=>facts},
  }));
  return {app,stage,notices:()=>notices,now,setFacts:(value:readonly ConsultationFact[])=>{facts=value;}};
}
export const professionalInput=(id=randomUUID(),message='¿En qué consiste la higiene y limpieza facial?')=>({id,fullName:'Caso sintético profesional',phone:'00000000',email:'',age:null,service:'higiene-y-limpieza-facial',message,responseChannel:'whatsapp',consent:true,consentVersion:'consultation-v1',aiConsent:false,website:''});
export function professionalClient(base:string){
  const path=base+'/api/beauty/inquiries';
  const headers=(id:string)=>({authorization:'Bearer synthetic-stage-admin',origin:'https://victoriosas.online','content-type':'application/json','x-consultation-approval':id});
  return {
    submit:(input:ReturnType<typeof professionalInput>)=>fetch(path,{method:'POST',headers:headers(input.id),body:JSON.stringify(input)}),
    read:(id:string,auth=true)=>fetch(path+'/admin/'+id+'/administrative-record',{headers:auth?headers(id):{}}),
    analyze:(id:string)=>fetch(path+'/admin/'+id+'/intelligence',{method:'POST',headers:headers(id),body:'{}'}),
    review:(id:string,run:string,text:string)=>fetch(path+'/admin/'+id+'/intelligence/'+run+'/review',{method:'POST',headers:headers(id),body:JSON.stringify({text,action:'approve'})}),
    status:(id:string,status:string)=>fetch(path+'/admin/'+id+'/case-status',{method:'POST',headers:headers(id),body:JSON.stringify({status})}),
  };
}
export async function proveProfessionalFlow(base:string,fixture:ReturnType<typeof createProfessionalStage>,id:string){
  const client=professionalClient(base),record=fixture.stage.record(id)!;
  assert.equal((await client.read(id,false)).status,401,'unauthorized session cannot inspect dossier');
  assert.equal((await client.status(id,'closed')).status,409,'unreviewed request cannot close in staging');
  assert.equal((await client.status(id,'in_review')).status,200);
  const r=await client.analyze(id);assert.equal(r.status,200);const analysis=await r.json();
  assert.equal(analysis.analysis.guardian.status,'approved',JSON.stringify(analysis.analysis.guardian));
  assert.equal(analysis.analysis.decision.action,'no_send');assert.equal(analysis.analysis.statistics.calls,0);
  assert.ok(analysis.analysis.evidence.length);assert.ok(analysis.analysis.evidence.every((f:ConsultationFact)=>f.approval==='approved'&&f.version&&f.source));
  assert.equal((await client.review(id,analysis.id,analysis.analysis.drafts[0].text+' Precio $500.')).status,409,'invented price cannot be approved');
  assert.equal((await client.review(id,analysis.id,analysis.analysis.drafts[0].text)).status,200);
  assert.equal((await client.status(id,'closed')).status,200);assert.equal((await client.status(id,'closed')).status,200);
  const dossier=await (await client.read(id)).json();
  assert.equal(dossier.status,'closed');assert.equal(dossier.responsible,stageAdmin);assert.equal(dossier.runs[0].reviewedBy,stageAdmin);
  assert.equal(dossier.simulation.label,'SIMULADO');assert.equal(dossier.simulation.delivery_decision,'no_send');assert.equal(dossier.simulation.acknowledgements,1);
  for(const kind of ['request_received','notice_acknowledged','analysis_claimed','draft_recorded','approve','simulated_acknowledgement','case_closed'])assert.ok(dossier.audit.some((e:{kind:string})=>e.kind===kind),kind);
  const noticeCount=fixture.notices();assert.equal((await client.submit(record.input as ReturnType<typeof professionalInput>)).status,202);assert.equal(fixture.notices(),noticeCount,'replay cannot duplicate notice');
  const recovered=new ConsultationProfessionalStage(fixture.stage.file,()=>approvedConsultationFacts,()=>fixture.now);
  assert.deepEqual(await recovered.administration.read(id),dossier,'new adapter reconstructs the durable case');
  return dossier;
}
export async function proveProfessionalNegatives(base:string,fixture:ReturnType<typeof createProfessionalStage>){
  const client=professionalClient(base);
  const expired=professionalInput();assert.equal((await client.submit(expired)).status,202);
  fixture.setFacts(approvedConsultationFacts.map(f=>({...f,validUntil:'2026-11-20T00:00:00Z'})));
  const stale=await (await client.analyze(expired.id)).json();assert.equal(stale.analysis.guardian.status,'blocked');
  assert.equal((await client.review(expired.id,stale.id,stale.analysis.drafts[0].text)).status,409);
  assert.equal((await client.status(expired.id,'closed')).status,409);
  fixture.setFacts(approvedConsultationFacts);
  const unknown=professionalInput(undefined,'¿Cuál es el precio de la higiene y limpieza facial?');assert.equal((await client.submit(unknown)).status,202);
  const price=await (await client.analyze(unknown.id)).json();assert.equal(price.analysis.decision.action,'no_send');
  assert.ok(!price.analysis.drafts.some((d:{text:string})=>/\$\s*\d|UYU\s*\d|USD\s*\d/.test(d.text)));
  assert.equal((await client.review(unknown.id,price.id,price.analysis.drafts[0].text+' Cuesta $500.')).status,409);
  const revoked=professionalInput();assert.equal((await client.submit(revoked)).status,202);
  const draft=await (await client.analyze(revoked.id)).json();fixture.stage.revoke(revoked.id);
  assert.equal((await client.review(revoked.id,draft.id,draft.analysis.drafts[0].text)).status,409);
  assert.equal((await client.status(revoked.id,'closed')).status,409);
  assert.equal((await client.read(revoked.id,false)).status,401);
  const blocked=await fetch(base+'/api/beauty/inquiries/admin/'+revoked.id+'/approve-send',{method:'POST'});
  assert.equal(blocked.status,409);assert.equal((await blocked.json()).delivery_decision,'no_send');
  return ['expired_source','unknown_price','revoked_consent','unauthorized_session'];
}
