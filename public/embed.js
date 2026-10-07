export function embedUrl(pageUrl,station){
  const url=new URL(pageUrl);
  if(!['https:','http:'].includes(url.protocol))throw new Error('Unsupported embed URL');
  url.search='';url.hash='';url.searchParams.set('station',station.id);
  url.searchParams.set('embed','1');
  return url.href;
}
export function embedCode(pageUrl,station){
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const policy=typeof document==='undefined'?null:document.permissionsPolicy||document.featurePolicy;
  const clipboard=policy?.features?.().includes('clipboard-write')?'; clipboard-write':'';
  return `<iframe src="${escape(embedUrl(pageUrl,station))}" title="${escape(`melodia · ${station.name}`)}" width="100%" height="600" style="border:0;border-radius:12px" loading="lazy" allow="fullscreen${clipboard}" allowfullscreen></iframe>`;
}