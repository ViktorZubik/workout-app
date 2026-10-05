(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WorkoutProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MUSCLE_GROUPS = Object.freeze(['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Кор']);
  const DEFAULT_EXERCISE_MUSCLES = Object.freeze({
    'Жим ногами в тренажёре': 'Ноги',
    'Сгибание ног сидя': 'Ноги',
    'Сгибание ног лёжа': 'Ноги',
    'Разгибание ног в тренажёре': 'Ноги',
    'Жим гантелей сидя': 'Плечи',
    'Жим гантелей на наклонной скамье': 'Грудь',
    'Жим от груди в рычажном тренажёре': 'Грудь',
    'Chest Press': 'Грудь',
    'Горизонтальное приведение плеча в тренажёре': 'Грудь',
    'Сведения рук в кроссовере сверху': 'Грудь',
    'Dip Machine': 'Руки',
    'Разгибание рук с канатом из-за головы': 'Руки',
    'Разгибание рук на блоке вниз': 'Руки',
    'Подтягивания в тренажёре с противовесом': 'Спина',
    'Горизонтальная тяга блока': 'Спина',
    'Вертикальная тяга блока': 'Спина',
    'Тяга штанги в наклоне': 'Спина',
    'Гиперэкстензия': 'Спина',
    'Сгибание рук с EZ-грифом': 'Руки',
    'Сгибание рук на бицепс в тренажёре': 'Руки',
    'Бицепс в кроссовере': 'Руки',
    'Скручивания на скамье с отрицательным наклоном': 'Кор'
  });

  const PERIODS = Object.freeze({
    '7d': {label:'7 дней', days:7},
    '30d': {label:'30 дней', days:30},
    '3m': {label:'3 месяца', months:3},
    '1y': {label:'Год', months:12},
    all: {label:'Всё время'}
  });
  const EXCLUDED_EXERCISE = /подтягиван|гравитрон/i;

  function isExcludedExercise(name) { return EXCLUDED_EXERCISE.test(String(name || '')); }
  // Treat missing text fields as empty so one malformed imported row cannot break analytics sorting.
  function compareText(a,b,locale) { return String(a??'').localeCompare(String(b??''),locale); }
  function numberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function parseDate(value, yearForShortDates=2026) {
    const s=String(value||'');
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m)return {year:+m[1],month:+m[2],day:+m[3]};
    m=s.match(/^(\d{2})\.(\d{2})$/);
    if(m&&yearForShortDates!==null)return {year:+yearForShortDates,month:+m[2],day:+m[1]};
    return null;
  }
  function toISO(parts) {
    return parts ? String(parts.year).padStart(4,'0')+'-'+String(parts.month).padStart(2,'0')+'-'+String(parts.day).padStart(2,'0') : '';
  }
  function isoDate(value,yearForShortDates=2026) { return toISO(parseDate(value,yearForShortDates)); }
  function dateValue(iso) {
    const p=parseDate(iso,null); if(!p)return NaN;const d=new Date(0);d.setUTCHours(0,0,0,0);d.setUTCFullYear(p.year,p.month-1,p.day);return d.getTime();
  }
  function isoFromValue(ms) {
    const d=new Date(ms);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
  }
  function dateLabel(iso) {
    const p=parseDate(iso,null);return p?String(p.day).padStart(2,'0')+'.'+String(p.month).padStart(2,'0'):'—';
  }
  function workoutDates(sessions, yearForShortDates=2026) {
    const list=Array.isArray(sessions)?sessions:Object.values(sessions||{});
    return [...new Set(list.map(s=>isoDate(s.date,yearForShortDates)).filter(Boolean))].sort();
  }
  function dateEntries(sessions, options={}) {
    const year=options.yearForShortDates===undefined?2026:options.yearForShortDates;
    const exclude=options.excludePullups!==false;
    const entries=[];
    const list=Array.isArray(sessions)?sessions:Object.entries(sessions||{}).map(([key,value])=>({...value,_key:key}));
    list.forEach(session=>{
      if(!session||typeof session!=='object')return;
      const date=isoDate(session.date,year);if(!date)return;
      (Array.isArray(session.exercises)?session.exercises:[]).forEach(exercise=>{
        if(!exercise||typeof exercise!=='object')return;
        const exerciseName=String(exercise.name||'').trim();
        if(!exerciseName||(exclude&&isExcludedExercise(exerciseName)))return;
        (Array.isArray(exercise.sets)?exercise.sets:[]).forEach((set,index)=>{
          if(!set||typeof set!=='object'||set.done===false)return;
          const reps=numberOrNull(set.reps),weight=numberOrNull(set.weight);
          if(reps===null||reps<0)return;
          entries.push({date,exercise:exerciseName,weight,reps,setNo:index+1,dayName:session.dayName||'',weightMode:exercise.weightMode||'load'});
        });
      });
    });
    return entries.sort((a,b)=>compareText(a.date,b.date)||compareText(a.exercise,b.exercise,'ru')||a.setNo-b.setNo);
  }
  function estimatedOneRepMax(weight,reps) {
    const w=numberOrNull(weight),r=numberOrNull(reps);
    if(w===null||r===null||w<=0||r<1)return null;
    return r===1?w:w*(1+r/30);
  }
  function isLoaded(entry) { return entry.weight!==null&&entry.weight>0&&entry.weightMode!=='assistance'; }
  function tonnage(entries) { return entries.reduce((sum,e)=>sum+(isLoaded(e)?e.weight*e.reps:0),0); }
  function workoutSeries(entries) {
    const workouts=new Map();
    entries.forEach(entry=>{
      if(!workouts.has(entry.date))workouts.set(entry.date,new Map());
      const map=workouts.get(entry.date);
      if(!map.has(entry.exercise))map.set(entry.exercise,[]);
      map.get(entry.exercise).push(entry);
    });
    return [...workouts].sort((a,b)=>compareText(a[0],b[0])).map(([date,exercises])=>({
      date,
      exercises:[...exercises].map(([exercise,sets])=>{
        const loaded=sets.filter(isLoaded);
        return {exercise,sets:sets.slice().sort((a,b)=>a.setNo-b.setNo),
          maxWeight:loaded.length?Math.max(...loaded.map(s=>s.weight)):null,
          oneRM:loaded.some(s=>s.reps>=1)?Math.max(...loaded.filter(s=>s.reps>=1).map(s=>estimatedOneRepMax(s.weight,s.reps))):null,
          maxReps:sets.length?Math.max(...sets.map(s=>s.reps)):null,
          tonnage:tonnage(sets)};
      })
    }));
  }
  function addMonths(iso,months) {
    const p=parseDate(iso,null),day=p.day;
    const first=new Date(Date.UTC(p.year,p.month-1+months,1));
    const lastDay=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    return toISO({year:first.getUTCFullYear(),month:first.getUTCMonth()+1,day:Math.min(day,lastDay)});
  }
  function periodBounds(period,asOfISO,entries=[]) {
    const asOf=isoDate(asOfISO,null)||asOfISO;
    const p=PERIODS[period]||PERIODS['30d'];
    let start;
    if(period==='all') {
      start=entries.length?entries.reduce((min,e)=>e.date<min?e.date:min,asOf):asOf;
    } else if(p.days) start=isoFromValue(dateValue(asOf)-(p.days-1)*86400000);
    else start=addMonths(asOf,-p.months);
    const previousEnd=isoFromValue(dateValue(start)-86400000);
    let previousStart;
    if(p.days) previousStart=isoFromValue(dateValue(start)-p.days*86400000);
    else if(p.months) previousStart=addMonths(start,-p.months);
    else {
      const span=Math.max(1,Math.floor((dateValue(asOf)-dateValue(start))/86400000)+1);
      previousStart=isoFromValue(dateValue(start)-span*86400000);
    }
    return {start,end:asOf,previousStart,previousEnd};
  }
  function filterRange(entries,start,end) { return entries.filter(e=>e.date>=start&&e.date<=end); }
  function summary(entries,start,end,goal=3,allWorkoutDates=null) {
    const selected=filterRange(entries,start,end);
    const dates=allWorkoutDates?allWorkoutDates.filter(d=>d>=start&&d<=end):[...new Set(selected.map(e=>e.date))];
    return {workouts:dates.length,tonnage:tonnage(selected),sets:selected.length};
  }
  function mondayOf(iso) {
    const d=dateValue(iso),weekday=(new Date(d).getUTCDay()+6)%7;
    return isoFromValue(d-weekday*86400000);
  }
  function weeklyBuckets(entries,start,end,goal=3,allWorkoutDates=null) {
    if(dateValue(start)>dateValue(end))return [];
    const counts=new Map();
    (allWorkoutDates?allWorkoutDates.filter(d=>d>=start&&d<=end):filterRange(entries,start,end).map(e=>e.date)).forEach(date=>counts.set(mondayOf(date),(counts.get(mondayOf(date))||new Set()).add(date)));
    const first=mondayOf(start),last=mondayOf(end),buckets=[];
    for(let d=dateValue(first),lastMs=dateValue(last);d<=lastMs;d+=7*86400000){
      const weekStart=isoFromValue(d),dates=counts.get(weekStart)||new Set();
      const boundedStart=weekStart<start?start:weekStart;
      const sun=isoFromValue(d+6*86400000),boundedEnd=sun>end?end:sun;
      buckets.push({weekStart,boundedStart,boundedEnd,count:dates.size,goal,met:dates.size>=goal});
    }
    return buckets;
  }
  function streaks(entries,goal=3,asOfISO,allWorkoutDates=null) {
    const dates=allWorkoutDates?[...new Set(allWorkoutDates)].sort():[...new Set(entries.map(e=>e.date))].sort();
    if(!dates.length)return {current:0,best:0};
    const asOf=asOfISO||dates[dates.length-1],counts=new Map();
    dates.forEach(date=>{const w=mondayOf(date);counts.set(w,(counts.get(w)||0)+1);});
    const first=mondayOf(dates[0]),last=mondayOf(asOf),weeks=[];
    for(let d=dateValue(first),end=dateValue(last);d<=end;d+=7*86400000){const w=isoFromValue(d);weeks.push({week:w,met:(counts.get(w)||0)>=goal});}
    let best=0,run=0;
    weeks.forEach(w=>{if(w.met){run++;best=Math.max(best,run);}else run=0;});
    // A not-yet-complete current week does not break the streak; count from the prior completed week.
    let i=weeks.length-1;if(i>=0&&!weeks[i].met)i--;
    let current=0;while(i>=0&&weeks[i].met){current++;i--;}
    return {current,best};
  }
  function relativeDelta(current,previous) {
    if(previous===0||previous===null||previous===undefined)return null;
    return ((current-previous)/Math.abs(previous))*100;
  }
  function getExerciseOptions(entries) {
    const map=new Map();
    entries.forEach(e=>{if(!map.has(e.exercise))map.set(e.exercise,{name:e.exercise,dates:new Set(),sets:0,last:e.date});const x=map.get(e.exercise);x.dates.add(e.date);x.sets++;if(e.date>x.last)x.last=e.date;});
    return [...map.values()].map(x=>({name:x.name,workouts:x.dates.size,sets:x.sets,last:x.last})).sort((a,b)=>b.workouts-a.workouts||b.sets-a.sets||compareText(b.last,a.last)||compareText(a.name,b.name,'ru'));
  }
  function exerciseWorkouts(entries,exercise,start,end) {
    const selected=entries.filter(e=>(!start||e.date>=start)&&(!end||e.date<=end));
    return workoutSeries(selected).map(w=>w.exercises.find(e=>e.exercise===exercise)).filter(Boolean);
  }
  function metricValue(workout,metric) {
    if(metric==='weight')return workout.maxWeight;
    if(metric==='1rm')return workout.oneRM;
    if(metric==='volume')return workout.tonnage;
    if(metric==='reps')return workout.maxReps;
    return null;
  }
  function exercisePersonalStats(workouts) {
    const by=workouts.slice().sort((a,b)=>compareText(a.date,b.date));
    let bestWeight=null,best1RM=null,bestReps=null;
    by.forEach(w=>{if(w.maxWeight!==null)bestWeight=Math.max(bestWeight??-Infinity,w.maxWeight);if(w.oneRM!==null)best1RM=Math.max(best1RM??-Infinity,w.oneRM);if(w.maxReps!==null)bestReps=Math.max(bestReps??-Infinity,w.maxReps);});
    return {bestWeight,best1RM,bestReps,first:by[0]||null};
  }
  function personalRecords(workouts) {
    const byExercise=new Map();
    workouts.forEach(w=>w.exercises.forEach(ex=>{if(!byExercise.has(ex.exercise))byExercise.set(ex.exercise,[]);byExercise.get(ex.exercise).push({...ex,date:w.date});}));
    const records=[];
    byExercise.forEach((list,exercise)=>{
      list.sort((a,b)=>compareText(a.date,b.date));
      if(list.length<2)return;
      let maxWeight=null,max1RM=null,maxTonnage=null;
      const bestRepsAtWeight=new Map();
      list.forEach((w,idx)=>{
        if(idx>0){
          if(w.maxWeight!==null&&(maxWeight===null||w.maxWeight>maxWeight))records.push({date:w.date,exercise,type:'maxWeight',oldValue:maxWeight,newValue:w.maxWeight});
          if(w.oneRM!==null&&(max1RM===null||w.oneRM>max1RM))records.push({date:w.date,exercise,type:'oneRM',oldValue:max1RM,newValue:w.oneRM});
          if(w.tonnage>0&&(maxTonnage===null||w.tonnage>maxTonnage))records.push({date:w.date,exercise,type:'tonnage',oldValue:maxTonnage,newValue:w.tonnage});
          const repsByWeight=new Map();
          w.sets.forEach(set=>{if(set.weight===null)return;const key=String(set.weight);repsByWeight.set(key,Math.max(repsByWeight.get(key)??-Infinity,set.reps));});
          repsByWeight.forEach((reps,key)=>{if(bestRepsAtWeight.has(key)&&reps>bestRepsAtWeight.get(key))records.push({date:w.date,exercise,type:'repsAtWeight',weight:Number(key),oldValue:bestRepsAtWeight.get(key),newValue:reps});});
        }
        if(w.maxWeight!==null)maxWeight=Math.max(maxWeight??-Infinity,w.maxWeight);
        if(w.oneRM!==null)max1RM=Math.max(max1RM??-Infinity,w.oneRM);
        if(w.tonnage>0)maxTonnage=Math.max(maxTonnage??-Infinity,w.tonnage);
        const repsByWeight=new Map();w.sets.forEach(set=>{if(set.weight===null)return;const key=String(set.weight);repsByWeight.set(key,Math.max(repsByWeight.get(key)??-Infinity,set.reps));});
        repsByWeight.forEach((reps,key)=>bestRepsAtWeight.set(key,Math.max(bestRepsAtWeight.get(key)??-Infinity,reps)));
      });
    });
    const order={maxWeight:0,repsAtWeight:1,oneRM:2,tonnage:3};
    return records.sort((a,b)=>compareText(b.date,a.date)||order[a.type]-order[b.type]||compareText(a.exercise,b.exercise,'ru'));
  }
  function muscleDistribution(entries,exerciseMuscles,start,end) {
    const selected=filterRange(entries,start,end),groups=new Map(MUSCLE_GROUPS.map(g=>[g,{group:g,sets:0,tonnage:0}]));
    groups.set('Без группы',{group:'Без группы',sets:0,tonnage:0});
    const unassigned=new Set();
    selected.forEach(e=>{
      const group=exerciseMuscles[e.exercise];
      if(!group||!MUSCLE_GROUPS.includes(group)){const x=groups.get('Без группы');x.sets++;x.tonnage+=tonnage([e]);unassigned.add(e.exercise);}
      else {const x=groups.get(group);x.sets++;x.tonnage+=tonnage([e]);}
    });
    return {groups:[...groups.values()],unassigned:[...unassigned].sort((a,b)=>compareText(a,b,'ru'))};
  }
  function groupWeeklyAverages(distribution,weeks) {
    const n=Math.max(1,weeks);
    return distribution.groups.map(g=>({...g,setsPerWeek:g.sets/n,share:distribution.groups.reduce((s,x)=>s+x.tonnage,0)?g.tonnage/distribution.groups.reduce((s,x)=>s+x.tonnage,0):0}));
  }
  function weekRange(asOf) {
    const weekStart=mondayOf(asOf),weekEnd=isoFromValue(dateValue(weekStart)+6*86400000);
    return {start:weekStart,end:weekEnd>asOf?asOf:weekEnd};
  }
  function monthRange(asOf) {
    const p=parseDate(asOf,null);return {start:toISO({year:p.year,month:p.month,day:1}),end:asOf};
  }
  function periodLengthWeeks(start,end) { return Math.max(1,(Math.floor((dateValue(end)-dateValue(start))/86400000)+1)/7); }
  function summarizePeriod(entries,period,asOfISO,goal=3,allWorkoutDates=null) {
    const bounds=periodBounds(period,asOfISO,entries),current=summary(entries,bounds.start,bounds.end,goal,allWorkoutDates),previous=summary(entries,bounds.previousStart,bounds.previousEnd,goal,allWorkoutDates);
    const weekly=weeklyBuckets(entries,bounds.start,bounds.end,goal,allWorkoutDates),streak=streaks(entries,goal,asOfISO,allWorkoutDates);
    const previousStreak=streaks(filterRange(entries,bounds.previousStart,bounds.previousEnd),goal,bounds.previousEnd,allWorkoutDates?.filter(d=>d>=bounds.previousStart&&d<=bounds.previousEnd));
    return {bounds,current,previous,deltas:{workouts:relativeDelta(current.workouts,previous.workouts),tonnage:relativeDelta(current.tonnage,previous.tonnage),sets:relativeDelta(current.sets,previous.sets),currentStreak:relativeDelta(streak.current,previousStreak.current),bestStreak:relativeDelta(streak.best,previousStreak.best)},streak,weekly,goalMetWeeks:weekly.filter(w=>w.met).length,goalWeekPercent:weekly.length?weekly.filter(w=>w.met).length/weekly.length*100:0};
  }
  function summarizeExercise(entries,exercise,start,end,metric='weight') {
    const workouts=exerciseWorkouts(entries,exercise,start,end),stats=exercisePersonalStats(exerciseWorkouts(entries,exercise,null,null));
    const series=workouts.map(w=>({date:w.date,value:metricValue(w,metric),isPR:false,workout:w}));
    const records=personalRecords(workoutSeries(entries)).filter(r=>r.exercise===exercise);
    const prDates=new Set(records.filter(r=>r.type===(metric==='weight'?'maxWeight':metric==='1rm'?'oneRM':metric==='volume'?'tonnage':'repsAtWeight')).map(r=>r.date));
    series.forEach(p=>p.isPR=prDates.has(p.date));
    const sortedAll=exerciseWorkouts(entries,exercise,null,null),first=sortedAll[0]||null,lastTen=workouts.slice().reverse().slice(0,10);
    const firstValue=first?metricValue(first,metric):null,lastValue=sortedAll.length?metricValue(sortedAll[sortedAll.length-1],metric):null;
    const gain=firstValue!==null&&lastValue!==null?lastValue-firstValue:null;
    return {workouts,stats,series,records,lastTen,first,firstValue,gain,gainPercent:firstValue>0&&gain!==null?gain/firstValue*100:null};
  }
  function weeklyDigest(entries,asOf,goal=3,allWorkoutDates=null) {
    const range=weekRange(asOf),records=personalRecords(workoutSeries(entries)).filter(r=>r.date>=range.start&&r.date<=range.end);
    return {range,summary:summary(entries,range.start,range.end,goal,allWorkoutDates),records,improving:topProgress(entries,range.start,range.end),stalled:stalledExercises(entries,asOf)};
  }
  function monthlyDigest(entries,asOf,goal=3,allWorkoutDates=null) {
    const range=monthRange(asOf),records=personalRecords(workoutSeries(entries)).filter(r=>r.date>=range.start&&r.date<=range.end);
    return {range,summary:summary(entries,range.start,range.end,goal,allWorkoutDates),records,improving:topProgress(entries,range.start,range.end),stalled:stalledExercises(entries,asOf)};
  }
  function topProgress(entries,start,end) {
    const names=[...new Set(entries.map(e=>e.exercise))],rows=[];
    names.forEach(name=>{
      const before=exerciseWorkouts(entries,name,null,start).slice(-1)[0],within=exerciseWorkouts(entries,name,start,end);
      const first=before?.oneRM??within[0]?.oneRM,last=within.slice().reverse().find(w=>w.oneRM!==null)?.oneRM;
      if(first!==null&&first!==undefined&&last!==null&&last!==undefined&&last>first)rows.push({exercise:name,gain:last-first,first,last});
    });
    return rows.sort((a,b)=>b.gain-a.gain)[0]||null;
  }
  function stalledExercises(entries,asOf,days=28) {
    const names=[...new Set(entries.map(e=>e.exercise))],asOfValue=dateValue(asOf),rows=[];
    names.forEach(name=>{
      const workouts=exerciseWorkouts(entries,name,null,asOf),weighted=workouts.filter(w=>w.oneRM!==null);
      if(weighted.length<2)return;
      let best=-Infinity,lastGrowthDate=null;
      weighted.forEach(w=>{if(w.oneRM>best){best=w.oneRM;lastGrowthDate=w.date;}});
      const since=Math.floor((asOfValue-dateValue(lastGrowthDate))/86400000);
      if(since>days)rows.push({exercise:name,lastGrowthDate,daysSince:since,best1RM:best});
    });
    return rows.sort((a,b)=>b.daysSince-a.daysSince);
  }
  function muscleImbalances(groups) {
    const loaded=groups,total=loaded.reduce((s,g)=>s+g.tonnage,0);
    if(!total)return [];
    return loaded.filter(g=>g.tonnage/total>0.4||g.tonnage/total<0.1).map(g=>({group:g.group,share:g.tonnage/total,type:g.tonnage/total>0.4?'high':'low'}));
  }
  function createMemo() {
    let key=null,value=null;
    return {get(nextKey,calculate){if(nextKey!==key){key=nextKey;value=calculate();}return value;},clear(){key=null;value=null;}};
  }
  return {MUSCLE_GROUPS,DEFAULT_EXERCISE_MUSCLES,PERIODS,isExcludedExercise,numberOrNull,parseDate,isoDate,dateLabel,workoutDates,dateEntries,estimatedOneRepMax,isLoaded,tonnage,workoutSeries,periodBounds,filterRange,summary,weeklyBuckets,streaks,relativeDelta,getExerciseOptions,exerciseWorkouts,metricValue,exercisePersonalStats,personalRecords,muscleDistribution,groupWeeklyAverages,weekRange,monthRange,periodLengthWeeks,summarizePeriod,summarizeExercise,weeklyDigest,monthlyDigest,muscleImbalances,createMemo};
});
