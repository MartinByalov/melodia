import {readSongMetadata,createNowPlayingQueue} from './now-playing.js';
let library;
const loadLibrary=()=>library??=(import('./vendor/hls.mjs').then(module=>module.default));

export function createHLSPlayback(load=loadLibrary){
  let generation=0,engine=null,cleanup=null;
  function destroy(){
    generation++;cleanup?.();cleanup=null;
    const previous=engine;engine=null;previous?.destroy();
  }
  return {
    destroy,
    async attach(element,url,onError,onSong=()=>{}){
      destroy();const token=generation;
      const Hls=await load();
      if(token!==generation)return false;
      if(!Hls.isSupported())throw new Error('HLS playback is unavailable in this browser.');
      engine=new Hls({maxBufferLength:10,maxMaxBufferLength:20,maxBufferSize:4*1024*1024,backBufferLength:3});
      const current=engine;
      const songs=createNowPlayingQueue();
      if(Hls.Events.FRAG_PARSING_METADATA)current.on(Hls.Events.FRAG_PARSING_METADATA,(_,data)=>{
        if(token!==generation)return;
        for(const sample of data.samples||[])songs.add(sample.pts,readSongMetadata(sample.data));
      });
      const updateSong=()=>{if(token!==generation)return;const song=songs.read(element.currentTime);if(song)onSong(song);};
      current.on(Hls.Events.ERROR,(_,data)=>{
        if(token!==generation||!data.fatal)return;
        destroy();onError(data);
      });
      const pause=()=>current.pauseBuffering();
      const resume=()=>current.resumeBuffering();
      element.addEventListener('pause',pause);element.addEventListener('play',resume);
      element.addEventListener('timeupdate',updateSong);
      cleanup=()=>{songs.clear();element.removeEventListener('timeupdate',updateSong);element.removeEventListener('pause',pause);element.removeEventListener('play',resume);};
      try{current.attachMedia(element);current.loadSource(url);}
      catch(error){destroy();throw error;}
      return true;
    }
  };
}