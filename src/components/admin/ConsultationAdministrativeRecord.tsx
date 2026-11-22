import React,{useState} from 'react';
import type { ConsultationAdministrativeRecord as Record } from '../../storefront/consultationAdministration';
const apiFetch=async(path:string)=>(await import('../../lib/api')).apiFetch(path);
export function ConsultationAdministrativeRecord({requestId}:{requestId:string}){
  const [record,setRecord]=useState<Record|null>(null),[error,setError]=useState('');
  async function load(){try{const r=await apiFetch('/api/beauty/inquiries/admin/'+encodeURIComponent(requestId)+'/administrative-record');if(!r.ok)throw Error();setRecord(await r.json());setError('');}catch{setError('No se pudo confirmar la trazabilidad administrativa.');}}
  return <div className="mt-3 rounded border border-neutral-600 p-3">
    <button type="button" className="min-h-11 rounded border px-3 py-2" onClick={()=>void load()}>Ver trazabilidad administrativa</button>
    {error&&<p role="alert">{error}</p>}
    {record&&<div aria-label="Trazabilidad administrativa">
      {record.simulation&&<p role="status">SIMULADO · no_send · acuses: {record.simulation.acknowledgements} · {record.simulation.receipt??'Sin acuse'}</p>}
      <p>Estado: {record.status} · Responsable: {record.responsible??'Sin asignar'} · Actualizado: {record.updatedAt??'Sin cambios'}</p>
      {record.runs.map(run=><div key={run.id} className="my-3 rounded bg-neutral-800 p-3">
        <p>Revisión: {run.state} · Responsable de revisión: {run.reviewedBy??'Pendiente'} · {run.reviewedAt??''}</p>
        <p>Decisión: {run.analysis.decision.action} · Versión de política: {run.analysis.policyVersion}</p>
        <p>Borrador conservado: {run.analysis.drafts[0]?.text}</p>
        <ul>{run.analysis.evidence.map(fact=><li key={fact.id}>Fuente: {fact.source} · Versión: {fact.version} · Aprobación: {fact.approval} · Responsable: {fact.owner}</li>)}</ul>
      </div>)}
      <ol aria-label="Auditoría administrativa">{record.audit.map((event,index)=><li key={index}>{event.at} · {event.kind} · {event.actor??'Sistema'}</li>)}</ol>
    </div>}
  </div>;
}
