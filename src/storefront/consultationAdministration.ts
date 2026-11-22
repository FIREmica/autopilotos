import { beautyServerDatabase } from './beautyDatabase';
import type { IntelligenceAnalysis } from './consultationIntelligence';

export type ConsultationCaseStatus = 'new'|'in_review'|'awaiting_contact'|'answered'|'closed';
export type ConsultationAdministrativeRecord = {
  status: ConsultationCaseStatus; responsible: string|null; updatedAt: string|null;
  runs: {id:string;state:string;analysis:IntelligenceAnalysis;reviewedBy:string|null;reviewedAt:string|null}[];
  audit: {kind:string;at:string;actor:string|null}[];
  simulation?: {label:'SIMULADO';delivery_decision:'no_send';acknowledgements:number;receipt:string|null};
};
/** Adapter for the existing case state and intelligence records; never owns delivery. */
export interface ConsultationAdministrationStore {
  state(request:string):Promise<Pick<ConsultationAdministrativeRecord,'status'|'responsible'|'updatedAt'>>;
  read(request:string):Promise<ConsultationAdministrativeRecord>;
  set(request:string,status:ConsultationCaseStatus,admin:string):Promise<boolean>;
  reply(request:string):Promise<{state:string;created_at?:string;sent_at?:string}|null>;
}
export const consultationAdministrationStore:ConsultationAdministrationStore={
  async state(request){const r=await beautyServerDatabase().from('consultation_case_states').select('status,updated_by,updated_at').eq('request_id',request).maybeSingle();if(r.error)throw Error('CONSULTATION_UNAVAILABLE');return {status:r.data?.status??'new',responsible:r.data?.updated_by??null,updatedAt:r.data?.updated_at??null};},
  async read(request){
    const db=beautyServerDatabase();
    const [state,runs]=await Promise.all([
      db.from('consultation_case_states').select('status,updated_by,updated_at').eq('request_id',request).maybeSingle(),
      db.from('consultation_intelligence_runs').select('id,state,analysis,approved_by,approved_at,created_at').eq('request_id',request).not('analysis','is',null).order('created_at',{ascending:false}).limit(20),
    ]);
    if(state.error||runs.error)throw Error('CONSULTATION_UNAVAILABLE');
    const data=runs.data??[];
    return {status:state.data?.status??'new',responsible:state.data?.updated_by??null,updatedAt:state.data?.updated_at??null,
      runs:data.map(r=>({id:r.id,state:r.state,analysis:r.analysis,reviewedBy:r.approved_by,reviewedAt:r.approved_at})),
      audit:data.flatMap(r=>[{kind:'analysis_recorded',at:r.created_at,actor:null},...(r.approved_at?[{kind:r.state,at:r.approved_at,actor:r.approved_by}]:[])]),
    };
  },
  async set(request,status,admin){const r=await beautyServerDatabase().from('consultation_case_states').upsert({request_id:request,status,updated_by:admin,updated_at:new Date().toISOString()},{onConflict:'request_id'});if(r.error)throw Error('CONSULTATION_UNAVAILABLE');return true;},
  async reply(request){const r=await beautyServerDatabase().from('consultation_reply_outbox').select('state,created_at,sent_at').eq('request_id',request).maybeSingle();if(r.error)throw Error('CONSULTATION_UNAVAILABLE');return r.data;},
};
