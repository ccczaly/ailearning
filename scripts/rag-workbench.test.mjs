import test from 'node:test';
import assert from 'node:assert/strict';
import { TeachingClock } from '../public/demos/rag/shared/clock.js';
import { cosine, retrievalMetrics } from '../src/rag-interaction.ts';
import { cosine as servedCosine } from '../public/demos/rag/shared/model.js';
function harness() {
  let now=0,next=0,count=0; const jobs=new Map(),retired=[];
  const clock=new TeachingClock(()=>{ count++;return count<6; },{delay:850,now:()=>now,timer:(callback,delay)=>{jobs.set(++next,{callback,at:now+delay});return next;},clear:id=>{retired.push(jobs.get(id)?.callback);jobs.delete(id);}});
  return {clock,jobs,retired,get count(){return count;}, advance(ms){now+=ms;for(const [id,job] of [...jobs])if(job.at<=now){jobs.delete(id);job.callback();}}};
}
test('pause preserves remaining delay; stale generation cannot advance',()=>{
  const h=harness();h.clock.play();h.advance(300);h.clock.pause();h.advance(5000);assert.equal(h.count,0);
  h.retired[0]();assert.equal(h.count,0);h.clock.play();h.advance(549);assert.equal(h.count,0);h.advance(1);assert.equal(h.count,1);
  h.clock.reset();h.advance(5000);assert.equal(h.count,1);assert.equal(h.jobs.size,0);
});
test('single step stops autoplay; final event and dispose leave no timer',()=>{
  const h=harness();h.clock.play();h.clock.step();assert.equal(h.count,1);assert.equal(h.jobs.size,0);
  h.clock.play();for(let i=0;i<5;i++)h.advance(850);assert.equal(h.count,6);assert.equal(h.clock.running,false);assert.equal(h.jobs.size,0);
  h.clock.play();h.clock.dispose();h.advance(1000);assert.equal(h.count,6);
});
test('cosine follows direction, ignores nonzero scale, handles undefined cases',()=>{
  assert.equal(cosine([1,0],[2,0]),1);assert.equal(cosine([1,0],[0,1]),0);assert.equal(cosine([1,0],[-1,0]),-1);
  assert.equal(cosine([1,0],[0,0]),undefined);assert.equal(cosine([1],[1,0]),undefined);assert.equal(cosine([NaN],[1]),undefined);
  assert.equal(servedCosine([1,0],[2,0]),1);
});
test('retrieval metrics distinguish missing and noise without duplicate inflation',()=>{
  assert.deepEqual(retrievalMetrics(['a','a','noise'],['a','b']),{hits:['a'],missing:['b'],noise:['noise'],recall:.5,precision:.5});
  assert.equal(retrievalMetrics([],['a']).precision,0);assert.equal(retrievalMetrics([],[]).recall,0);
});
test('default scheduling preserves the browser timer receiver', t => {
  t.mock.method(globalThis,'setTimeout',function(){ assert.equal(this,globalThis);return 123; });
  t.mock.method(globalThis,'clearTimeout',function(id){ assert.equal(this,globalThis);assert.equal(id,123); });
  const clock=new TeachingClock(()=>false);clock.play();clock.pause();
});
