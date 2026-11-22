// Loopback-only staging: real form, inbox and HTTP routes; durable synthetic store and no live sender.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdirSync,writeFileSync,mkdtempSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer as createViteServer} from 'vite';
import react from '@vitejs/plugin-react';
import {createProfessionalStage,professionalClient,professionalInput,proveProfessionalFlow,proveProfessionalNegatives} from '../tests/fixtures/consultationProfessionalProof';

if(!process.argv.includes('--synthetic'))throw Error('SYNTHETIC_OPT_IN_REQUIRED');
const directory=mkdtempSync(path.join(tmpdir(),'victoriosas-professional-stage-'));
const fixture=createProfessionalStage(path.join(directory,'stage.json'));
const vite=await createViteServer({configFile:false,root:process.cwd(),plugins:[react(),{
  name:'professional-staging-entry',enforce:'pre',
  resolveId(id){if(id==='/__professional.js')return '\0professional-entry';if(id==='../../lib/api'||id.endsWith('/src/lib/api.ts'))return '\0professional-api';},
  load(id){
    if(id==='\0professional-entry')return `import React from 'react';import {createRoot} from 'react-dom/client';import {ConsultationForm} from '/src/components/public/ConsultationForm.tsx';import {ConsultationInbox} from '/src/components/admin/ConsultationInbox.tsx';createRoot(document.getElementById('root')).render(React.createElement(location.pathname.startsWith('/admin')?ConsultationInbox:ConsultationForm));`;
    if(id==='\0professional-api')return `export async function apiFetch(path,options={}){if(!path.startsWith('/api/beauty/inquiries'))throw Error('STAGING_PATH_DENIED');const headers=new Headers(options.headers);headers.set('authorization','Bearer synthetic-stage-admin');return fetch(path,{...options,headers});}`;
  },
}],server:{middlewareMode:true,hmr:false,fs:{allow:[process.cwd(),realpathSync('node_modules')]}},appType:'custom'});
for(const route of ['/consultanos','/admin/consultas'])fixture.app.get(route,async(_req,res)=>res.type('html').send(await vite.transformIndexHtml(route,'<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p>STAGING LOCAL · SIMULADO · no_send</p><div id="root"></div><script type="module" src="/__professional.js"></script></body></html>')));
fixture.app.use(vite.middlewares);
const server=fixture.app.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
console.log('stage: server HTML', (await fetch(base+'/consultanos')).status);
const {chromium}=await import(process.env.CONSULTATION_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('response',response=>{if(response.status()>=400)console.error('stage response',response.status(),new URL(response.url()).pathname);});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  // No remote request can leave staging. The synthetic harness represents the HTTPS canonical origin
  // on loopback without modifying the router's production origin validation.
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==base)return route.abort();
    if(url.pathname.startsWith('/api/')&&request.method()==='POST'){const response=await route.fetch({headers:{...request.headers(),origin:'https://victoriosas.online'}});return route.fulfill({response});}
    return route.continue();
  });
  console.log('stage: public form',base);
  page.on('console',message=>{if(message.type()==='error')console.error(message.text());});
  await page.goto(base+'/consultanos',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Enviar consulta',exact:true}).waitFor();
  await page.waitForFunction(()=>!(document.querySelector('button[type=submit]') as HTMLButtonElement)?.disabled,undefined,{timeout:15000});
  await page.locator('[name=fullName]').fill('Caso sintético profesional navegador');
  await page.locator('[name=phone]').fill('00000000');
  await page.locator('[name=service]').selectOption('higiene-y-limpieza-facial');
  await page.locator('[name=message]').fill('¿En qué consiste la higiene y limpieza facial?');
  await page.locator('[name=channel][value=whatsapp]').check();
  await page.locator('[name=consent]').check();
  await page.getByRole('button',{name:'Enviar consulta',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Tu consulta quedó registrada'}).waitFor();
  const id=fixture.stage.ids()[0],client=professionalClient(base);
  console.log('stage: admin panel');
  await page.goto(base+'/admin/consultas');
  await page.getByRole('heading',{name:'Caso sintético profesional navegador · Higiene y limpieza facial'}).waitFor();
  const status=page.getByLabel('Estado administrativo');await status.selectOption('in_review');
  await page.getByRole('button',{name:'Analizar con evidencia',exact:true}).click();
  const review=page.getByRole('button',{name:'Validar texto sin enviar',exact:true});await review.waitFor();
  assert.equal(await review.isEnabled(),true);await review.click();
  await page.getByRole('status').filter({hasText:'Validación registrada para este texto'}).waitFor();
  await status.selectOption('closed');
  await page.getByRole('button',{name:'Ver trazabilidad administrativa',exact:true}).click();
  const trace=page.getByLabel('Trazabilidad administrativa',{exact:true});
  await trace.getByText(/Estado: closed/).waitFor();
  assert.match(await trace.innerText(),/SIMULADO.*no_send.*acuses: 1/);
  assert.match(await trace.innerText(),/Fuente:.*Versión:/);assert.match(await trace.innerText(),/Revisión: approved/);
  mkdirSync('output/consultation-professional',{recursive:true});
  await page.screenshot({path:'output/consultation-professional/panel-desktop.png',fullPage:true});
  await page.reload();await page.getByRole('button',{name:'Ver trazabilidad administrativa',exact:true}).click();
  await page.getByLabel('Trazabilidad administrativa',{exact:true}).getByText(/Estado: closed/).waitFor();
  assert.equal((await client.status(id,'closed')).status,200);
  assert.equal((await (await client.read(id)).json()).simulation.acknowledgements,1);
  const other=professionalInput();assert.equal((await client.submit(other)).status,202);await proveProfessionalFlow(base,fixture,other.id);
  const negatives=await proveProfessionalNegatives(base,fixture);
  assert.deepEqual(errors,[]);
  const result={label:'SIMULADO',delivery_decision:'no_send',environment:'loopback-local-staging',publicForm:true,panelReconstructedAfterReload:true,requestId:id,simulatedAcknowledgements:1,negatives,stageFile:fixture.stage.file,remoteCalls:0,applicationErrors:errors};
  writeFileSync('output/consultation-professional/result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await vite.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
