export function safeHomepage(value){
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function stationUrl(page,station){
  const url=new URL(page);
  const slug=station.name.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,100)||'radio';
  url.searchParams.delete('radio');url.searchParams.delete('station');
  url.searchParams.set('radio',slug);url.searchParams.set('station',station.id);
  return url;
}
export function continuePlayback(state){return state==='playing'||state==='loading';}