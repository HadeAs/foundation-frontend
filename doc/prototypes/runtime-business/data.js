// Review-only snapshots. These values and labels are not production dictionaries.
window.runtimeData = (() => {
  const relation = (label,target,category) => ({label,target,category});
  const fields = {
    id:{label:'记录 ID'},containerId:relation('容器','container'),boxId:relation('料箱','container','BOX'),vehicleId:relation('载具','container','VEHICLE'),vehicleSlotId:relation('装载位','slot'),locationId:relation('固定位置','location'),currentContainerId:relation('当前容器','container'),lastProductionLineId:relation('最近产线','line'),
    relationMode:{label:'装载方式',options:{DIRECT:'直接装载',SLOT:'装载位装载'}},bindingStatus:{label:'关系状态',options:{ACTIVE:'有效',UNBOUND:'已解绑'}},bindingMode:{label:'绑定方式',options:{BY_CODE:'按唯一码',BY_ORDER:'按订单数量'}},
    contentState:{label:'内容状态',options:{UNKNOWN:'未确认',EMPTY:'已确认空载',LOADED:'已确认有内容'}},runtimeUsage:{label:'当前用途',options:{MATERIAL:'板件物料',FIXTURE:'治具'}},rivetState:{label:'铆接状态',options:{NOT_RIVETED:'未铆接',RIVETED:'已铆接'}},fixtureState:{label:'治具状态',options:{READY:'可用',USED:'已使用'}},presenceState:{label:'在位状态',options:{UNKNOWN:'未确认',EMPTY:'空位',PRESENT:'有容器'}},autoLogisticsEnabled:{label:'自动物流',options:{true:'开启',false:'关闭'}},
    orderNo:{label:'订单号'},materialCode:{label:'物料编码'},materialBatch:{label:'物料批次'},panelCode:{label:'板件唯一码'},quantity:{label:'绑定数量'},totalQuantity:{label:'总数量'},reservationKey:{label:'预占标识'},reservedTime:{label:'预占时间'},warehouseRequestId:{label:'缴库请求 ID'},presenceUpdatedTime:{label:'在位更新时间'},boundTime:{label:'绑定时间'},unboundTime:{label:'解绑时间'},createdTime:{label:'创建时间'},updatedTime:{label:'更新时间'},
    activePanelCode:{label:'有效唯一码索引'},activeBoxId:{label:'有效料箱索引'},activeVehicleSlotId:{label:'有效装载位索引'},version:{label:'数据版本'},bizDate:{label:'业务日期'},sourceSystem:{label:'来源系统'},traceId:{label:'Trace ID'},idempotentKey:{label:'幂等键'},
  };
  const common=['id','createdTime','updatedTime','bizDate','sourceSystem','traceId','idempotentKey','version'];
  const pages={
    vehicleLoad:{label:'箱车装载关系',icon:'cart',schema:'VehicleLoad',defaults:{bindingStatus:'ACTIVE'},filters:['vehicleId','boxId','bindingStatus'],more:['relationMode','vehicleSlotId'],columns:['boxId','vehicleId','relationMode','vehicleSlotId','bindingStatus','boundTime','unboundTime','createdTime','updatedTime'],details:['boxId','vehicleId','relationMode','vehicleSlotId','bindingStatus','boundTime','unboundTime'],technical:['activeBoxId','activeVehicleSlotId']},
    locationState:{label:'位置运行状态',icon:'pin',schema:'LocationState',defaults:{},filters:['locationId','presenceState','currentContainerId'],more:['autoLogisticsEnabled','reservationKey'],columns:['locationId','presenceState','currentContainerId','autoLogisticsEnabled','reservationKey','presenceUpdatedTime','createdTime','updatedTime'],details:['locationId','presenceState','currentContainerId','autoLogisticsEnabled','presenceUpdatedTime','reservationKey','reservedTime'],technical:[]},
    containerState:{label:'容器运行状态',icon:'box',schema:'ContainerState',defaults:{},filters:['containerId','contentState','runtimeUsage'],more:['orderNo','materialCode','materialBatch','rivetState','fixtureState','lastProductionLineId','reservationKey','warehouseRequestId'],columns:['containerId','contentState','runtimeUsage','orderNo','materialCode','totalQuantity','reservationKey','createdTime','updatedTime'],details:['containerId','contentState','runtimeUsage','totalQuantity','orderNo','materialCode','materialBatch','rivetState','fixtureState','lastProductionLineId','reservationKey','reservedTime','warehouseRequestId'],technical:[]},
    boxBinding:{label:'物料绑箱关系',icon:'link',schema:'BoxBinding',defaults:{bindingStatus:'ACTIVE'},filters:['boxId','bindingStatus','bindingMode'],more:['orderNo','materialCode','materialBatch','panelCode'],columns:['boxId','bindingMode','orderNo','materialCode','materialBatch','panelCode','quantity','bindingStatus','boundTime','unboundTime','createdTime','updatedTime'],details:['boxId','bindingMode','orderNo','materialCode','materialBatch','panelCode','quantity','bindingStatus','boundTime','unboundTime'],technical:['activePanelCode']},
  };
  const stamp=(id)=>({id,version:1,createdTime:`2026-10-14 08:${String(id%60).padStart(2,'0')}:00`,updatedTime:`2026-10-14 09:${String(id%60).padStart(2,'0')}:00`,bizDate:'2026-10-14',sourceSystem:'NARI-LES',traceId:`demo-trace-${id}`,idempotentKey:`demo-event-${id}`});
  const rows={
    vehicleLoad:[
      {boxId:3,vehicleId:1,vehicleSlotId:1,relationMode:'SLOT',bindingStatus:'ACTIVE',boundTime:'2026-10-14 09:01:00',unboundTime:null,activeBoxId:3,activeVehicleSlotId:1},
      {boxId:4,vehicleId:2,vehicleSlotId:null,relationMode:'DIRECT',bindingStatus:'ACTIVE',boundTime:'2026-10-14 09:05:00',unboundTime:null,activeBoxId:4,activeVehicleSlotId:null},
      {boxId:6,vehicleId:1,vehicleSlotId:2,relationMode:'SLOT',bindingStatus:'ACTIVE',boundTime:'2026-10-14 09:08:00',unboundTime:null,activeBoxId:6,activeVehicleSlotId:2},
      {boxId:4,vehicleId:1,vehicleSlotId:3,relationMode:'SLOT',bindingStatus:'UNBOUND',boundTime:'2026-10-14 07:45:00',unboundTime:'2026-10-14 08:40:00',activeBoxId:null,activeVehicleSlotId:null},
      {boxId:3,vehicleId:2,vehicleSlotId:null,relationMode:'DIRECT',bindingStatus:'UNBOUND',boundTime:'2026-10-13 14:15:00',unboundTime:'2026-10-14 08:50:00',activeBoxId:null,activeVehicleSlotId:null},
    ],
    locationState:[
      {locationId:1,presenceState:'PRESENT',currentContainerId:1,autoLogisticsEnabled:true,presenceUpdatedTime:'2026-10-14 09:01:00',reservationKey:'TASK-20261014-018',reservedTime:'2026-10-14 08:58:00'},
      {locationId:2,presenceState:'EMPTY',currentContainerId:null,autoLogisticsEnabled:true,presenceUpdatedTime:'2026-10-14 09:03:00',reservationKey:null,reservedTime:null},
      {locationId:3,presenceState:'UNKNOWN',currentContainerId:null,autoLogisticsEnabled:null,presenceUpdatedTime:null,reservationKey:null,reservedTime:null},
      {locationId:4,presenceState:'PRESENT',currentContainerId:2,autoLogisticsEnabled:false,presenceUpdatedTime:'2026-10-14 09:05:00',reservationKey:null,reservedTime:null},
      {locationId:5,presenceState:'EMPTY',currentContainerId:null,autoLogisticsEnabled:true,presenceUpdatedTime:'2026-10-14 08:45:00',reservationKey:'TASK-20261014-021',reservedTime:'2026-10-14 09:10:00'},
      {locationId:6,presenceState:'EMPTY',currentContainerId:null,autoLogisticsEnabled:false,presenceUpdatedTime:'2026-10-14 08:42:00',reservationKey:null,reservedTime:null},
    ],
    containerState:[
      {containerId:1,contentState:'LOADED',runtimeUsage:null,totalQuantity:null,orderNo:null,materialCode:null,materialBatch:null,rivetState:null,fixtureState:null,lastProductionLineId:1,reservationKey:'TASK-20261014-018',reservedTime:'2026-10-14 08:58:00',warehouseRequestId:null},
      {containerId:2,contentState:'LOADED',runtimeUsage:null,totalQuantity:null,orderNo:null,materialCode:null,materialBatch:null,rivetState:null,fixtureState:null,lastProductionLineId:3,reservationKey:null,reservedTime:null,warehouseRequestId:null},
      {containerId:3,contentState:'LOADED',runtimeUsage:'MATERIAL',totalQuantity:24,orderNo:'000240914007',materialCode:'PCB-6001',materialBatch:'LOT-261014-A',rivetState:'NOT_RIVETED',fixtureState:null,lastProductionLineId:1,reservationKey:null,reservedTime:null,warehouseRequestId:null},
      {containerId:4,contentState:'EMPTY',runtimeUsage:'MATERIAL',totalQuantity:0,orderNo:null,materialCode:null,materialBatch:null,rivetState:null,fixtureState:null,lastProductionLineId:2,reservationKey:null,reservedTime:null,warehouseRequestId:null},
      {containerId:6,contentState:'LOADED',runtimeUsage:'FIXTURE',totalQuantity:4,orderNo:'000240914008',materialCode:null,materialBatch:null,rivetState:null,fixtureState:'READY',lastProductionLineId:3,reservationKey:null,reservedTime:null,warehouseRequestId:null},
    ],
    boxBinding:[
      {boxId:3,bindingMode:'BY_ORDER',orderNo:'000240914007',materialCode:'PCB-6001',materialBatch:'LOT-261014-A',panelCode:null,quantity:23,bindingStatus:'ACTIVE',boundTime:'2026-10-14 08:46:00',unboundTime:null,activePanelCode:null},
      {boxId:3,bindingMode:'BY_CODE',orderNo:'000240914007',materialCode:'PCB-6001',materialBatch:'LOT-261014-A',panelCode:'PNL-0000261014001',quantity:1,bindingStatus:'ACTIVE',boundTime:'2026-10-14 08:49:00',unboundTime:null,activePanelCode:'PNL-0000261014001'},
      {boxId:4,bindingMode:'BY_ORDER',orderNo:'000240914006',materialCode:'PCB-5002',materialBatch:'LOT-261013-B',panelCode:null,quantity:36,bindingStatus:'UNBOUND',boundTime:'2026-10-13 16:00:00',unboundTime:'2026-10-14 08:30:00',activePanelCode:null},
      {boxId:4,bindingMode:'BY_CODE',orderNo:'000240914005',materialCode:'PCB-5002',materialBatch:'LOT-261013-A',panelCode:'PNL-0000261013002',quantity:1,bindingStatus:'UNBOUND',boundTime:'2026-10-13 12:02:00',unboundTime:'2026-10-13 15:21:00',activePanelCode:null},
    ],
  };
  for(const key of Object.keys(rows))rows[key]=rows[key].map((row,i)=>({...stamp(i+1),...row}));
  return {fields,pages,rows,common};
})();
