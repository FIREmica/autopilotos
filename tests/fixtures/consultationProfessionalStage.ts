import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {ConsultationStore,ConsultationRecord} from '../../src/storefront/consultationSupabase';
import type {IntelligenceStore} from '../../src/storefront/consultationIntelligenceStore';
import {checkExactAnswer,type IntelligenceAnalysis} from '../../src/storefront/consultationIntelligence';
import type {ConsultationAdministrationStore,ConsultationAdministrativeRecord} from '../../src/storefront/consultationAdministration';
import type {ConsultationFact} from '../../src/storefront/consultationEvidence';

export const stageAdmin='11111111-1111-4111-8111-111111111111';
type Saved={record:ConsultationRecord;fingerprint:string;lease:string;notice:string|null;workflow:ConsultationAdministrativeRecord;run?:{id:string;lease:string;version:string;analysis?:IntelligenceAnalysis}};
/** Test-only durable implementations of the three existing stores. No network or live sender exists. */
export class ConsultationProfessionalStage{
  private data:Record<string,Saved>;
  constructor(readonly file:string,readonly facts:()=>readonly ConsultationFact[],readonly now:()=>Date,readonly adminToken:string){
    this.data=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
  }
  private save(){writeFileSync(this.file+'.tmp',JSON.stringify(this.data,null,2));renameSync(this.file+'.tmp',this.file);}
  private active(id:string){const item=this.data[id];return item&&Date.parse(item.record.expires_at)>+this.now()?item:undefined;}
  private audit(item:Saved,kind:string,actor:string|null=null){item.workflow.audit.push({kind,actor,at:this.now().toISOString()});}
  record(id:string){return this.data[id]?.record;}
  revoke(id:string){const item=this.data[id];(item.record.input as unknown as {consent:boolean}).consent=false;this.audit(item,'consent_revoked',stageAdmin);this.save();}
  ids(){return Object.keys(this.data);}
  readonly requests:ConsultationStore={
    ready:async()=>true,
    claim:async(input,fingerprint)=>{
      if(!input.fullName.startsWith('Caso sintético')||!input.consent)throw Error('SYNTHETIC_ONLY');
      const previous=this.data[input.id];
      if(previous)return {state:previous.fingerprint!==fingerprint?'conflict':previous.notice?'accepted':'pending'};
      const lease=randomUUID();this.data[input.id]={record:{id:input.id,input:structuredClone(input),created_at:this.now().toISOString(),expires_at:new Date(+this.now()+30*86400000).toISOString()},fingerprint,lease,notice:null,
        workflow:{status:'new',responsible:null,updatedAt:null,runs:[],audit:[{kind:'request_received',actor:null,at:this.now().toISOString()}],simulation:{label:'SIMULADO',delivery_decision:'no_send',acknowledgements:0,receipt:null}}};this.save();return {state:'send',lease};
    },
    finish:async(id,lease,provider)=>{const item=this.active(id);if(!item||item.lease!==lease||!provider.startsWith('SIMULADO:'))return false;item.notice=provider;this.audit(item,'notice_acknowledged');this.save();return true;},
    get:async(token,id)=>token===this.adminToken?structuredClone(this.active(id)?.record??null):null,
    list:async(token,offset)=>token===this.adminToken?Object.values(this.data).filter(v=>this.active(v.record.id)).map(v=>structuredClone(v.record)).slice(offset,offset+50):[],
  };
  readonly intelligence:IntelligenceStore={
    claim:async(request,version)=>{const item=this.active(request);if(!item)return {state:'failed'};
      if(item.run?.version===version&&item.run.analysis)return {state:'ready',id:item.run.id,analysis:structuredClone(item.run.analysis)};
      if(item.run&&!item.run.analysis)return {state:'busy',id:item.run.id};
      item.run={id:randomUUID(),lease:randomUUID(),version};this.audit(item,'analysis_claimed');this.save();return {state:'claimed',id:item.run.id,lease:item.run.lease};},
    finish:async(id,lease,analysis)=>{const item=Object.values(this.data).find(v=>v.run?.id===id);if(!item||item.run?.lease!==lease)return false;
      item.run.analysis=structuredClone(analysis);item.workflow.runs=[{id,state:'ready',analysis:structuredClone(analysis),reviewedBy:null,reviewedAt:null}];this.audit(item,'draft_recorded');this.save();return true;},
    get:async(request,id)=>{const r=this.active(request)?.run;return r?.id===id&&r.analysis?{id,analysis:structuredClone(r.analysis)}:null;},
    review:async(request,id,admin,text,_fingerprint,action)=>{const item=this.active(request);if(!item||item.run?.id!==id||!item.run.analysis||admin!==stageAdmin)return false;
      if(action==='approve'&&checkExactAnswer(item.run.analysis,item.record,text,this.now(),this.facts()).status!=='approved')return false;
      const row=item.workflow.runs[0];row.state=action==='approve'?'approved':'rejected';row.reviewedBy=admin;row.reviewedAt=this.now().toISOString();this.audit(item,action,admin);this.save();return true;},
    reserve:async()=>false,report:async()=>({mode:'shadow',synthetic:true}),events:async()=>[],
  };
  readonly administration:ConsultationAdministrationStore={
    state:async(id)=>{const item=this.active(id);if(!item)throw Error('NOT_FOUND');const {status,responsible,updatedAt}=item.workflow;return {status,responsible,updatedAt};},
    read:async(id)=>{const item=this.active(id);if(!item)throw Error('NOT_FOUND');return structuredClone(item.workflow);},
    reply:async()=>null,
    set:async(id,status,admin)=>{const item=this.active(id);if(!item||admin!==stageAdmin||!item.record.input.consent)return false;
      const current=item.workflow.status;
      if(status===current)return true;
      if(status==='closed'){
        const run=item.workflow.runs[0];if(!run||run.state!=='approved'||checkExactAnswer(run.analysis,item.record,run.analysis.drafts[0].text,this.now(),this.facts()).status!=='approved')return false;
        // Synthetic acknowledgement only: deterministic key, no sender capability, no delivery admission.
        const simulation=item.workflow.simulation!;
        if(!simulation.receipt){simulation.receipt='SIMULADO:'+id+':'+run.analysis.fingerprint;simulation.acknowledgements++;this.audit(item,'simulated_acknowledgement',admin);}
      }else if(status!=='in_review'||current!=='new')return false;
      item.workflow.status=status;item.workflow.responsible=admin;item.workflow.updatedAt=this.now().toISOString();this.audit(item,'case_'+status,admin);this.save();return true;},
  };
}
