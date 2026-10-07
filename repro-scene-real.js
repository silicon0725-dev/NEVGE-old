const VM = require('scratch-vm');
const JSZip = require('@turbowarp/jszip');
const ScratchStorage = require('@turbowarp/scratch-storage');
const {createModuleManager} = require('./src/lib/first-party-modules/module-manager');
const {registerBuiltInModules} = require('./src/lib/first-party-modules');
const {MODULE_PERMISSIONS} = require('./src/lib/first-party-modules/constants');
const {createVMProjectIOService} = require('./src/lib/first-party-modules/vm-project-io-service');
const {createBlankSceneProjectJSON, BLANK_BACKDROP_FILE_NAME, BLANK_BACKDROP_SVG, BLANK_BACKDROP_ASSET_ID} = require('./src/lib/scene-system/blank-scene-project');
const {SCENE_MANAGER_CAPABILITY_ID, SCENE_RUNTIME_CAPABILITY_ID, SCENE_SYSTEM_MODULE_ID} = require('./src/lib/scene-system/constants');
(async()=>{
 const vm=new VM();
 const storage=new ScratchStorage();
 storage.cache(storage.AssetType.ImageVector, storage.DataFormat.SVG, Buffer.from(BLANK_BACKDROP_SVG), BLANK_BACKDROP_ASSET_ID);
 vm.attachStorage(storage);
 const zip=new JSZip();
 zip.file('project.json', JSON.stringify(createBlankSceneProjectJSON()));
 zip.file(BLANK_BACKDROP_FILE_NAME, BLANK_BACKDROP_SVG);
 const sb3=await zip.generateAsync({type:'uint8array'});
 try { await vm.loadProject(sb3); console.log('loaded targets',vm.runtime.targets.length, vm.serializeAssets().map(x=>[x.fileName,x.fileContent && x.fileContent.constructor && x.fileContent.constructor.name, x.fileContent instanceof Uint8Array])); }
 catch(e){console.error('load fail',e); process.exit(1)}
 const manager=createModuleManager({services:{
  runtime:{permission:MODULE_PERMISSIONS.RUNTIME,value:vm.runtime},
  vm:{permission:MODULE_PERMISSIONS.RUNTIME,value:vm},
  'vm-project-io':{permission:MODULE_PERMISSIONS.RUNTIME,value:createVMProjectIOService(vm)}
 }});
 registerBuiltInModules(manager); manager.initializeAll(); manager.enableDefaults({silent:true}); manager.enableModule(SCENE_SYSTEM_MODULE_ID,{silent:true});
 const sm=manager.client.getCapability(SCENE_MANAGER_CAPABILITY_ID); const sr=manager.client.getCapability(SCENE_RUNTIME_CAPABILITY_ID);
 console.log('scenes before', sm.listScenes().map(s=>({id:s.id,name:s.name,active:s.isActive})));
 try {
   const created=await sm.createScene({name:'Real Asset Scene'}); console.log('created',created.id);
   const res=await sr.loadScene(created.id); console.log('load result',res);
 } catch(e){ console.error('SCENE FAIL',e); console.error('code',e.code,'portable',e.portableDetails,'cause',e.cause); process.exitCode=2; }
})();
