function text(bytes){
  if(!bytes.length)return '';
  const encoding=bytes[0],data=bytes.subarray(1);
  return new TextDecoder(encoding===1?'utf-16':encoding===2?'utf-16be':encoding===3?'utf-8':'windows-1252').decode(data).replace(/\0/g,' ').trim();
}
const syncSize=bytes=>bytes.reduce((size,value)=>(size<<7)|(value&127),0);

// Read title/artist text frames only; never guess a song from unrelated ID3 data.
export function readSongMetadata(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  let artist='',title='';
  for(let offset=0;offset+10<=bytes.length;offset++){
    if(bytes[offset]!==73||bytes[offset+1]!==68||bytes[offset+2]!==51)continue;
    const version=bytes[offset+3],flags=bytes[offset+5];
    if((version!==3&&version!==4)||(flags&192))continue;
    const end=Math.min(bytes.length,offset+10+syncSize(bytes.subarray(offset+6,offset+10)));
    let frame=offset+10;
    while(frame+10<=end){
      const id=String.fromCharCode(...bytes.subarray(frame,frame+4));
      const size=version===4?syncSize(bytes.subarray(frame+4,frame+8)):new DataView(bytes.buffer,bytes.byteOffset+frame+4,4).getUint32(0);
      if(!size||frame+10+size>end)break;
      if(bytes[frame+8]===0&&bytes[frame+9]===0){
        if(id==='TIT2')title=text(bytes.subarray(frame+10,frame+10+size));
        if(id==='TPE1')artist=text(bytes.subarray(frame+10,frame+10+size));
      }
      frame+=10+size;
    }
    offset=end-1;
  }
  return title?{artist,title,label:artist?`${artist} — ${title}`:title}:null;
}

export function createNowPlayingQueue(){
  let entries=[];
  return {
    clear(){entries=[];},
    add(time,song){if(song&&Number.isFinite(time)){entries.push({time,song});entries.sort((a,b)=>a.time-b.time);entries=entries.slice(-64);}},
    read(time){let song=null;while(entries.length&&entries[0].time<=time+.1)song=entries.shift().song;return song;}
  };
}