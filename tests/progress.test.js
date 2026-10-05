const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../progress.js');

const sample = {
  '2026-08-18-2': {date:'18.08',dayName:'Спина + бицепс',exercises:[
    {name:'Тяга штанги в наклоне',sets:[{reps:10,weight:40,done:true},{reps:8,weight:50,done:true}]},
    {name:'Скручивания',sets:[{reps:15,weight:0,done:true}]},
    {name:'Подтягивания в тренажёре с противовесом',weightMode:'assistance',sets:[{reps:6,weight:21,done:true}]}
  ]},
  '2026-08-22-2': {date:'2026-08-22',dayName:'Спина + бицепс',exercises:[
    {name:'Тяга штанги в наклоне',sets:[{reps:10,weight:45,done:true},{reps:8,weight:50,done:true}]},
    {name:'Скручивания',sets:[{reps:18,weight:0,done:true}]}
  ]},
  '2026-08-25-1': {date:'25.08',dayName:'Грудь + трицепс',exercises:[
    {name:'Жим гантелей',sets:[{reps:8,weight:20,done:true}]}
  ]}
};

test('Epley 1RM uses exact load for one rep',()=>{
  assert.equal(P.estimatedOneRepMax(100,1),100);
  assert.equal(P.estimatedOneRepMax(100,5),100*(1+5/30));
  assert.equal(P.estimatedOneRepMax(0,12),null);
});

test('short dates use the configured year and pull-ups are excluded',()=>{
  const rows=P.dateEntries(sample,{yearForShortDates:2026});
  assert(rows.some(x=>x.date==='2026-08-18'));
  assert.equal(rows.some(x=>P.isExcludedExercise(x.exercise)),false);
  assert.equal(rows.find(x=>x.exercise==='Скручивания').weight,0);
});

test('tonnage sums only positive external loads',()=>{
  const rows=P.dateEntries(sample);
  assert.equal(P.tonnage(rows),40*10+50*8+45*10+50*8+20*8);
});

test('all sets from one date make one workout, even across split sessions',()=>{
  const rows=P.dateEntries(sample);
  const result=P.summary(rows,'2026-08-18','2026-08-18',3);
  assert.equal(result.workouts,1);
  assert.equal(result.sets,3);
});

test('weekly buckets and streak goal use distinct workout dates',()=>{
  const entries=['2026-08-03','2026-08-04','2026-08-05','2026-08-10','2026-08-11','2026-08-12'].map((date,i)=>({date,exercise:'x',weight:10,reps:5,setNo:i}));
  const weeks=P.weeklyBuckets(entries,'2026-08-03','2026-08-16',3);
  assert.equal(weeks.length,2);
  assert.equal(weeks.filter(w=>w.met).length,2);
  assert.deepEqual(P.streaks(entries,3,'2026-08-16'),{current:2,best:2});
});

test('records are derived and never treat the first workout as a PR',()=>{
  const rows=P.dateEntries(sample);
  const records=P.personalRecords(P.workoutSeries(rows));
  assert(records.some(r=>r.exercise==='Тяга штанги в наклоне'&&r.type==='tonnage'&&r.date==='2026-08-22'));
  assert.equal(records.some(r=>r.date==='2026-08-18'),false);
});

test('exercise summary reports max reps for zero-weight training',()=>{
  const rows=P.dateEntries(sample);
  const exercise=P.exerciseWorkouts(rows,'Скручивания','2026-08-01','2026-08-31');
  assert.equal(exercise[0].maxWeight,null);
  assert.equal(exercise[0].oneRM,null);
  assert.equal(exercise[0].maxReps,15);
  assert.equal(exercise[0].tonnage,0);
});
