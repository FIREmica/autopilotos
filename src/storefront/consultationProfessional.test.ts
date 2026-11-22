import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createProfessionalStage,professionalClient,professionalInput,proveProfessionalFlow,proveProfessionalNegatives} from '../../tests/fixtures/consultationProfessionalProof';

test('professional staging exercises normal HTTP intake, reviewed no_send workflow, durable panel record and negative gates',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'consultation-professional-'));
  const fixture=createProfessionalStage(path.join(dir,'stage.json'));
  const server=fixture.app.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
  try{
    const input=professionalInput();assert.equal((await professionalClient(base).submit(input)).status,202);
    await proveProfessionalFlow(base,fixture,input.id);
    assert.equal((await proveProfessionalNegatives(base,fixture)).length,4);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});}
});
