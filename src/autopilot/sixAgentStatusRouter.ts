import {Router} from 'express';
import {createClient} from '@supabase/supabase-js';
import {requireSupabaseAdminAuth} from '../security/adminAuth';
import {summarizeOfficeStatus} from './sixAgentOffice';

export function createSixAgentStatusRouter() {
 const router=Router();
 router.use(requireSupabaseAdminAuth);
 router.get('/',async (_req,res)=>{
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:'AGENT_STATUS_NOT_CONFIGURED'});
  try {
   const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await db.from('agent_tasks')
    .select('id,agent_id,status,attempt_count,created_at,updated_at,lease_until,completed_evidence')
    .not('agent_id','is',null).order('updated_at',{ascending:false}).limit(500);
   if(error)return res.status(503).json({error:'AGENT_SCHEMA_NOT_READY'});
   const records=data??[];
   return res.json({source:'supabase',generatedAt:new Date().toISOString(),partial:records.length===500,
     agents:summarizeOfficeStatus(records,new Date(),records.length===500)});
  } catch {return res.status(503).json({error:'AGENT_STATUS_UNAVAILABLE'});}
 });
 return router;
}
