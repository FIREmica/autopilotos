import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createProfessionalStage,professionalClient,professionalInput,proveProfessionalFlow,proveProfessionalNegatives} from '../../tests/fixtures/consultationProfessionalProof';
import {consultationSyntheticRouteAllowed} from './consultationSyntheticBoundary';

test('synthetic route allowlist rejects sender, dispatch and production metric endpoints',()=>{
  for(const path of [
    '/admin/123e4567-e89b-42d3-a456-426614174000/approve-send',
    '/admin/123e4567-e89b-42d3-a456-426614174000/APPROVE-SEND/',
    '/admin/123e4567-e89b-42d3-a456-426614174000/draft-ai/',
    '/admin/123e4567-e89b-42d3-a456-426614174000/intelligence/123e4567-e89b-42d3-a456-426614174001/dispatch/',
    '/admin/metrics',
  ]){
    assert.equal(consultationSyntheticRouteAllowed('POST',path),false,path);
  }
  assert.equal(consultationSyntheticRouteAllowed('POST','/admin//123e4567-e89b-42d3-a456-426614174000/case-status/'),true);
  assert.equal(consultationSyntheticRouteAllowed('GET','/config/'),true);
});

test('professional staging exercises normal HTTP intake, reviewed no_send workflow, durable panel record and negative gates',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'consultation-professional-'));
  const fixture=createProfessionalStage(path.join(dir,'stage.json'));
  const server=fixture.app.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
  try{
    const input=professionalInput();assert.equal((await professionalClient(base,fixture.adminToken).submit(input)).status,202);
    await proveProfessionalFlow(base,fixture,input.id);
    assert.equal((await proveProfessionalNegatives(base,fixture)).length,4);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});}
});

test('synthetic HTTP stage cannot reach production-capable routes even with live flags inherited',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'consultation-professional-boundary-'));
  const saved=Object.fromEntries(['AUTOPILOT_RUNTIME','CONSULTATION_PRIVACY_APPROVED','CONSULTATION_REPLY_SENDING_ENABLED','CONSULTATION_MAIL_PROVIDER','RESEND_API_KEY','CONSULTATION_MAIL_FROM','CONSULTATION_INTELLIGENCE_LIVE_REVIEW_ENABLED','CONSULTATION_INTELLIGENCE_MODE','CONSULTATION_INTELLIGENCE_ACTIVATION_APPROVED'].map(key=>[key,process.env[key]]));
  Object.assign(process.env,{
    AUTOPILOT_RUNTIME:'supabase-edge',CONSULTATION_PRIVACY_APPROVED:'true',CONSULTATION_REPLY_SENDING_ENABLED:'true',
    CONSULTATION_MAIL_PROVIDER:'resend',RESEND_API_KEY:'synthetic-test-not-a-credential',CONSULTATION_MAIL_FROM:'consultas@victoriosas.online',
    CONSULTATION_INTELLIGENCE_LIVE_REVIEW_ENABLED:'true',CONSULTATION_INTELLIGENCE_MODE:'review',CONSULTATION_INTELLIGENCE_ACTIVATION_APPROVED:'true',
  });
  const fixture=createProfessionalStage(path.join(dir,'stage.json'));
  const server=fixture.app.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
  try{
    const input=professionalInput();input.email='synthetic@example.test';input.aiConsent=true;
    const client=professionalClient(base,fixture.adminToken);
    assert.equal((await client.submit(input)).status,202);
    const routes=[
      ['GET',`/admin/metrics`],
      ['POST',`/admin/${input.id}/approve-send`],
      ['POST',`/admin/${input.id}/APPROVE-SEND/`],
      ['POST',`/admin/${input.id}/draft-ai/`],
      ['POST',`/admin/${input.id}/intelligence/123e4567-e89b-42d3-a456-426614174001/dispatch/`],
    ] as const;
    for(const [method,route] of routes){
      const response=await fetch(base+'/api/beauty/inquiries'+route,{method,headers:{authorization:`Bearer ${fixture.adminToken}`,origin:'https://victoriosas.online','x-consultation-approval':input.id,'content-type':'application/json'},body:method==='POST'?'{}':undefined});
      assert.equal(response.status,409,route);
      assert.equal((await response.json()).delivery_decision,'no_send',route);
    }
    assert.deepEqual(fixture.deniedOperationCalls(),{metrics:0,shadow:1,reply:0,dispatch:0,knowledge:0});
  }finally{
    server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});
    for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
