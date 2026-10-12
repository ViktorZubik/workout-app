const assert=require('node:assert/strict');
const {test}=require('node:test');
const Export=require('../export-core.js');

test('empty history exports as valid backward-compatible JSON',()=>{
  const result=Export.createChatGPTExport({},'2026-10-12T09:00:00.000Z');
  const parsed=JSON.parse(JSON.stringify(result));
  assert.equal(parsed.version,1);
  assert.equal(parsed.exported,'2026-10-12T09:00:00.000Z');
  assert.equal(parsed.workoutCount,0);
  assert.equal(parsed.dateRange,null);
  assert.deepEqual(parsed.sessions,{});
  assert.equal(Export.isValidSessions(parsed.sessions),true);
});

test('export preserves session, exercise, set, cardio, date and numeric values',()=>{
  const sessions={
    '2026-10-05-2':{id:'s1',date:'2026-10-05',dayIdx:2,dayName:'Спина + бицепс',synced:true,exercises:[
      {name:'Тяга штанги в наклоне',muscle:'Спина',weightMode:'load',sets:[{reps:8,weight:40,done:true},{reps:8,weight:45,done:true}]},
      {name:'Эллипс',muscle:'Кардио',weightMode:'cardio',sets:[{duration:25,distance:3.4,done:true}]}
    ]},
    '06.10-4':{id:'s2',date:'06.10',dayIdx:4,dayName:'Кардио',synced:true,exercises:[{name:'Беговая дорожка',muscle:'Кардио',weightMode:'cardio',sets:[{duration:15,distance:2,done:true}]}]}
  };
  const result=Export.createChatGPTExport(sessions,'2026-10-12T09:00:00.000Z');
  assert.deepEqual(result.sessions,sessions);
  assert.equal(result.workoutCount,2);
  assert.deepEqual(result.dateRange,{start:'2026-10-05',end:'2026-10-06'});
  assert.equal(result.sessions['2026-10-05-2'].exercises[0].sets[1].weight,45);
  assert.equal(result.sessions['2026-10-05-2'].exercises[1].sets[0].duration,25);
  assert.equal(result.sessions['2026-10-05-2'].exercises[1].sets[0].distance,3.4);
  assert.equal('current' in result,false);
  assert.equal('settings' in result,false);
});

test('a complete Apps Script response is accepted; a failed or partial response is rejected',()=>{
  assert.equal(Export.isSuccessfulSheetsPayload({ok:true,sessions:{}}),true);
  assert.equal(Export.isSuccessfulSheetsPayload({ok:false,sessions:{}}),false);
  assert.equal(Export.isSuccessfulSheetsPayload({ok:true,sessions:null}),false);
  assert.equal(Export.isSuccessfulSheetsPayload({ok:true,sessions:{bad:{date:'2026-10-05',exercises:null}}}),false);
});

test('local sessions without positive Sheets confirmation block a complete export',()=>{
  assert.deepEqual(Export.findUnconfirmedSessions({a:{synced:true},b:{synced:false},c:{}}),['b','c']);
});

test('export readiness blocks missing, stale, changed and unsynchronized Sheets snapshots',()=>{
  assert.equal(Export.exportReadiness({scriptUrl:'',loadedAt:10}), 'not-connected');
  assert.equal(Export.exportReadiness({scriptUrl:'https://example.test',loadedAt:0}), 'not-loaded');
  assert.equal(Export.exportReadiness({scriptUrl:'https://example.test',loadedAt:10,now:300011}), 'stale');
  assert.equal(Export.exportReadiness({scriptUrl:'https://example.test',loadedAt:10,now:20,signatureMatches:false}), 'changed');
  assert.equal(Export.exportReadiness({scriptUrl:'https://example.test',loadedAt:10,now:20,sessions:{a:{synced:false}}}), 'pending');
  assert.equal(Export.exportReadiness({scriptUrl:'https://example.test',loadedAt:10,now:20,sessions:{a:{synced:true}}}), 'ready');
});

test('export can still be imported by the existing version 1 backup reader shape',()=>{
  const result=Export.createChatGPTExport({'2026-10-05-0':{id:'x',date:'2026-10-05',exercises:[{name:'Жим',muscle:'Грудь',weightMode:'load',sets:[{reps:10,weight:20,done:true}]}]}});
  assert.equal(result.version,1);
  assert.ok(result.sessions&&typeof result.sessions==='object');
  assert.equal(Array.isArray(result.sessions),false);
});
