#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
class FakeZip { file(){return this;} folder(){return this;} async generateAsync(){return Buffer.from('');} static async loadAsync(){return new FakeZip();} }
Module._load = function (request, parent, isMain) { if (request === '@turbowarp/jszip') return FakeZip; return originalLoad(request, parent, isMain); };
const {MODULE_AVAILABILITY, MODULE_KINDS, createModuleManager} = require('../src/lib/first-party-modules');
const manifest = (id, dependencies = []) => ({apiVersion:'1', availability:MODULE_AVAILABILITY.AVAILABLE, capabilities:[], defaultEnabled:false, dependencies:dependencies.map(x=>({id:x,optional:false})), description:id, id, kind:MODULE_KINDS.FIRST_PARTY, name:id, permissions:[], version:'1'});

// Observers cannot synchronously mutate lifecycle state.
{
 const manager=createModuleManager();
 manager.registerModule({manifest:manifest('x'),hooks:{enable:c=>c.capabilities.provide('x.registration',{ok:true})}});
 manager.subscribe(change=>{ if(change.type==='module:enable-pending') manager.disableModule(change.moduleId,{force:true}); });
 assert.strictEqual(manager.enableModule('x'),true);
 assert.strictEqual(manager.getModuleState('x').enabled,true);
 assert(manager.getCapability('x.registration'));
 assert.strictEqual(manager.getObserverErrorSnapshot().lastError.code,'MODULE_OBSERVER_REENTRANT_MUTATION');
 manager.dispose();
}

// completeEnable may append enable requests, but cannot perform destructive lifecycle mutations.
{
 const manager=createModuleManager();
 manager.registerModule({manifest:manifest('core'),hooks:{
  enable:c=>c.capabilities.provide('core.registration',{ok:true}),
  completeEnable:c=>{
   assert.strictEqual(c.manager.disableModule,undefined);
   assert.strictEqual(c.manager.registry,undefined);
   assert.strictEqual(c.manager.capabilities,undefined);
   assert.strictEqual(c.manager.dataStore,undefined);
  }
 }});
 assert.strictEqual(manager.enableModule('core'),true);
 assert.strictEqual(manager.getModuleState('core').enabled,true);
 assert(manager.getCapability('core.registration'));
 manager.dispose();
}

// A module cannot replace another provider's capability, even with replace:true.
{
 const manager=createModuleManager();
 manager.registerModule({manifest:manifest('owner'),hooks:{initialize:c=>c.capabilities.provide('shared',{value:'old'})}});
 manager.registerModule({manifest:manifest('attacker'),hooks:{initialize:c=>c.capabilities.provide('shared',{value:'new'},{replace:true})}});
 assert.strictEqual(manager.initializeModule('owner'),true);
 assert.throws(()=>manager.initializeModule('attacker'), e=>e&&e.code==='MODULE_CAPABILITY_PROVIDER_REPLACEMENT_FORBIDDEN');
 assert.deepStrictEqual(manager.getCapability('shared'),{value:'old'});
 assert.strictEqual(manager.getModuleState('attacker').initialized,false);
 manager.dispose();
}

Module._load=originalLoad;
console.log('NGVGE TASK 0008.9.4.1.3 module lifecycle mutation authority validation passed.');
