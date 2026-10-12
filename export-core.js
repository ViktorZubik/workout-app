(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.WorkoutExport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function hasValidDate(value){return typeof value==='string'&&(/^(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2})$/.test(value));}
  function numberOrBlank(value){return value===undefined||value===null||value===''||Number.isFinite(Number(String(value).replace(',','.')));}
  function isValidSessions(sessions){
    if(!sessions||typeof sessions!=='object'||Array.isArray(sessions))return false;
    return Object.values(sessions).every(session=>session&&typeof session==='object'&&hasValidDate(session.date)&&Array.isArray(session.exercises)&&session.exercises.every(exercise=>{
      if(!exercise||typeof exercise!=='object'||typeof exercise.name!=='string'||!exercise.name.trim()||!Array.isArray(exercise.sets))return false;
      const cardio=exercise.weightMode==='cardio';
      return exercise.sets.every(set=>set&&typeof set==='object'&&(cardio
        ? numberOrBlank(set.duration)&&numberOrBlank(set.distance)
        : numberOrBlank(set.reps)&&numberOrBlank(set.weight)));
    }));
  }
  function isSuccessfulSheetsPayload(payload){return !!payload&&payload.ok===true&&isValidSessions(payload.sessions);}
  function findUnconfirmedSessions(sessions){return Object.entries(sessions||{}).filter(([,session])=>!session||session.synced!==true).map(([key])=>key);}
  function exportReadiness({scriptUrl,loadedAt,signatureMatches=true,now=Date.now(),sessions={},maxAgeMs=300000}){
    if(!scriptUrl)return 'not-connected';
    if(!loadedAt)return 'not-loaded';
    if(now-loadedAt>maxAgeMs)return 'stale';
    if(!signatureMatches)return 'changed';
    if(findUnconfirmedSessions(sessions).length)return 'pending';
    return 'ready';
  }
  function toISODate(value){
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return value;
    const match=String(value||'').match(/^(\d{2})\.(\d{2})$/);
    return match?'2026-'+match[2]+'-'+match[1]:'';
  }
  function createChatGPTExport(sessions,exportedAt=new Date().toISOString()){
    if(!isValidSessions(sessions))throw new TypeError('Некорректный формат истории тренировок');
    const dates=Object.values(sessions).map(session=>toISODate(session.date)).filter(Boolean).sort();
    return {
      version:1,
      exportType:'workouts-for-chatgpt',
      exported:exportedAt,
      workoutCount:Object.keys(sessions).length,
      dateRange:dates.length?{start:dates[0],end:dates[dates.length-1]}:null,
      sessions
    };
  }
  return {isValidSessions,isSuccessfulSheetsPayload,findUnconfirmedSessions,exportReadiness,createChatGPTExport};
});
