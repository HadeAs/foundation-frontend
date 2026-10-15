// Offline review fixtures only. Not a production dictionary or API fallback.
(() => {
  const fields = {};
  const define = (key, label, extra = {}) => (fields[key] = { label, ...extra });
  const textFields = {
    id:'记录 ID', version:'版本', bizDate:'业务日期', sourceSystem:'来源系统', traceId:'Trace ID', idempotentKey:'幂等键',
    taskNo:'运输任务号', taskStatus:'任务状态', orderNo:'生产订单号', businessCode:'业务编码', callNo:'叫料单号', agvCode:'AGV 编码', agvName:'AGV 名称', schedulerTaskNo:'调度任务号', queueNo:'队列序号',
    triggerMode:'触发方式', dispatchMode:'调度方式', destinationMode:'目的地模式', vendor:'AGV 厂商', sendAttemptCount:'发送次数', reason:'原因', productionPlanId:'生产计划 ID',
    activeCancelRequestId:'当前取消请求 ID', createRequestId:'创建请求 ID', intentKey:'业务意图键', originLocationCode:'起点位置编码', destinationLocationCode:'终点位置编码',
    eventType:'事件类型', eventKey:'事件键', externalEventKey:'外部事件键', operationKey:'操作键', cancelStatus:'取消状态', evidenceSource:'证据来源', requestId:'请求 ID', requestHash:'请求摘要', taskVersion:'任务版本',
    applicationNo:'缴库申请号', objectId:'业务对象 ID', sapDocumentNos:'SAP 凭证号', submittedVersion:'提交版本', boxVersion:'料箱版本', materialCode:'物料编码', materialBatch:'物料批次', quantity:'数量',
    wmsCleanupStatus:'WMS 清理状态', cleanupRequestId:'清理请求 ID', contentKey:'内容键', receivingNo:'接收单号', remark:'备注',
  };
  Object.entries(textFields).forEach(([key,label]) => define(key,label));
  ['id','version','queueNo','sendAttemptCount','productionPlanId','taskVersion','objectId','submittedVersion','boxVersion','quantity'].forEach(key => fields[key].number = true);
  const refs = {
    containerId:['容器','container'], boxId:['料箱','container'], activeBoxId:['当前有效料箱','container'], emptyBoxId:['空箱','container'],
    originVehicleId:['起点载具','container'], destinationVehicleId:['终点载具','container'], originVehicleSlotId:['起点装载位','slot'], destinationVehicleSlotId:['终点装载位','slot'],
    locationId:['位置','location'], originLocationId:['起点位置','location'], destinationLocationId:['终点位置','location'], emptyOriginLocationId:['空箱起点','location'], emptyDestinationLocationId:['空箱终点','location'],
    taskId:['关联运输任务','task'], logisticsTaskId:['关联运输任务','task'], warehouseRecordId:['所属缴库记录','warehouse'], receivingRecordId:['关联接收记录','receiving'], warehouseRecordBoxId:['缴库箱明细','warehouseBox'],
  };
  Object.entries(refs).forEach(([key,[label,target]]) => define(key,label,{target,number:true}));
  Object.entries({createdTime:'创建时间',updatedTime:'更新时间',cancelSentTime:'取消发送时间',completedTime:'任务完成时间',lastSentTime:'最近发送时间',nextCheckTime:'下次检查时间',settledTime:'结算时间',statusUpdatedTime:'状态更新时间',occurredTime:'事件发生时间',succeededTime:'缴库成功时间',cleanupSentTime:'清理发送时间',cleanupCompletedTime:'清理完成时间',receivedTime:'接收时间'}).forEach(([key,label])=>define(key,label,{time:true}));
  Object.entries({dispatchRequestSnapshot:'调度请求快照',warehouseBoxSnapshot:'缴库箱快照',beforeState:'操作前状态',afterState:'操作后状态',resultSnapshot:'操作结果快照',bindingSnapshot:'绑箱快照',wmsScopeSnapshot:'WMS 范围快照'}).forEach(([key,label])=>define(key,label,{snapshot:true}));
  const options = {
    taskStatus:{QUEUED:['排队中','neutral'],DISPATCHING:['下发中','info'],ACCEPTED:['已受理','info'],RUNNING:['执行中','teal'],COMPLETED:['已完成','good'],FAILED:['失败','danger'],CANCELLED:['已取消','neutral'],UNKNOWN:['未确认','warn']},
    wmsCleanupStatus:{NOT_REQUESTED:['未请求','neutral'],SENDING:['发送中','info'],CLEARED:['已清理','good'],FAILED:['失败','danger'],UNKNOWN:['未确认','warn']},
    cancelStatus:{ACCEPTED:['已受理','info'],CANCELLED:['已取消','neutral'],FAILED:['失败','danger'],UNKNOWN:['未确认','warn']},
    triggerMode:{AUTO:['自动','info'],PDA:['PDA','teal'],EXTERNAL:['外部系统','neutral']},
    dispatchMode:{NORMAL:['普通配送','neutral'],WITH_EMPTY_BOX:['携带空箱','info']},
    destinationMode:{SPECIFIED:['指定位置','neutral'],RETURN_LINE_SIDE:['返回线边','info']},
    evidenceSource:{PDA:['PDA','teal'],OPC_ROUTER:['OPC Router','info'],DISPATCH:['调度系统','info'],SYSTEM:['系统','neutral'],MANUAL_RECONCILE:['人工核对','warn']},
  };
  Object.entries(options).forEach(([key,values])=>fields[key].options=values);
  const common = ['version','bizDate','sourceSystem','traceId','idempotentKey'];
  const times = ['createdTime','updatedTime'];
  const pages = {
    task:{name:'物流运输任务',schema:'NariLogisticsTask',resource:'nari-logistics-task',icon:'truck',identity:'taskNo',
      filters:['taskNo','orderNo','taskStatus','containerId'],
      more:['businessCode','callNo','agvCode','schedulerTaskNo','originLocationCode','destinationLocationCode','dispatchMode','triggerMode','destinationMode','vendor','queueNo','productionPlanId','originLocationId','destinationLocationId','originVehicleId','originVehicleSlotId','destinationVehicleId','destinationVehicleSlotId','emptyBoxId','emptyOriginLocationId','emptyDestinationLocationId','completedTimeRange','statusUpdatedTimeRange','lastSentTimeRange','cancelSentTimeRange','settledTimeRange','nextCheckTimeRange','sendAttemptCount','createRequestId','activeCancelRequestId','intentKey'],
      columns:['taskNo','taskStatus','orderNo','containerId','originLocationCode','destinationLocationCode','agvCode','queueNo','createdTime','updatedTime'],
      details:['taskNo','taskStatus','orderNo','businessCode','callNo','containerId','agvCode','agvName','schedulerTaskNo','queueNo','triggerMode','dispatchMode','destinationMode','vendor','productionPlanId','originLocationCode','originLocationId','destinationLocationCode','destinationLocationId','originVehicleId','originVehicleSlotId','destinationVehicleId','destinationVehicleSlotId','emptyBoxId','emptyOriginLocationId','emptyDestinationLocationId','sendAttemptCount','reason','lastSentTime','cancelSentTime','completedTime','settledTime','statusUpdatedTime','nextCheckTime',...times],
      technical:['activeCancelRequestId','createRequestId','intentKey'],snapshots:['dispatchRequestSnapshot','warehouseBoxSnapshot'],sort:['createdTime','updatedTime','queueNo']},
    operation:{name:'业务操作记录',schema:'NariOperationRecord',resource:'nari-operation-record',icon:'history',identity:'eventKey',
      filters:['eventType','taskId','occurredTimeRange'],more:['containerId','locationId','warehouseRecordId','receivingRecordId','cancelStatus','evidenceSource','operationKey','eventKey','externalEventKey','requestId','requestHash','taskVersion'],
      columns:['occurredTime','eventType','taskId','containerId','evidenceSource','cancelStatus','reason',...times],
      details:['eventType','eventKey','operationKey','occurredTime','evidenceSource','cancelStatus','taskId','containerId','locationId','warehouseRecordId','receivingRecordId','reason',...times],
      technical:['externalEventKey','requestId','requestHash','taskVersion'],snapshots:['beforeState','afterState','resultSnapshot'],sort:times},
    warehouse:{name:'缴库成功记录',schema:'NariWarehouseRecord',resource:'nari-warehouse-record',icon:'warehouse',identity:'applicationNo',
      filters:['applicationNo','succeededTimeRange'],more:['objectId','requestId','submittedVersion'],columns:['applicationNo','objectId','sapDocumentNos','succeededTime',...times],
      details:['applicationNo','objectId','sapDocumentNos','succeededTime','submittedVersion',...times],technical:['requestId'],snapshots:[],sort:times},
    warehouseBox:{name:'缴库成功箱明细',schema:'NariWarehouseRecordBox',resource:'nari-warehouse-record-box',icon:'box',identity:'id',
      filters:['boxId','orderNo','materialCode','wmsCleanupStatus'],more:['warehouseRecordId','materialBatch','quantity','activeBoxId','boxVersion','contentKey','cleanupRequestId','cleanupSentTimeRange','cleanupCompletedTimeRange','nextCheckTimeRange'],
      columns:['warehouseRecordId','boxId','orderNo','materialCode','materialBatch','quantity','wmsCleanupStatus',...times],
      details:['warehouseRecordId','boxId','orderNo','materialCode','materialBatch','quantity','wmsCleanupStatus','reason','cleanupSentTime','cleanupCompletedTime','nextCheckTime',...times],technical:['activeBoxId','boxVersion','cleanupRequestId','contentKey'],snapshots:['bindingSnapshot','wmsScopeSnapshot'],sort:times},
    receiving:{name:'库房接收记录',schema:'NariReceivingRecord',resource:'nari-receiving-record',icon:'receive',identity:'receivingNo',
      filters:['receivingNo','boxId','receivedTimeRange'],more:['logisticsTaskId','warehouseRecordBoxId','requestId','remark'],
      columns:['receivingNo','boxId','logisticsTaskId','warehouseRecordBoxId','receivedTime','remark',...times],
      details:['receivingNo','boxId','logisticsTaskId','warehouseRecordBoxId','receivedTime','remark',...times],technical:['requestId'],snapshots:[],sort:times},
  };
  const rows = Object.fromEntries(Object.keys(pages).map(key=>[key,[]]));
  const boxIds = [3,4,6];
  for(let id=1;id<=28;id++) {
    const time=`2026-10-${String(13+Math.floor((id-1)/10)).padStart(2,'0')} ${String(8+(id%8)).padStart(2,'0')}:30:00`;
    const orderNo=`000241015${String(id).padStart(3,'0')}`;
    const meta={id,version:1,bizDate:time.slice(0,10),sourceSystem:'NARI-LES',traceId:`trace-demo-${id}`,idempotentKey:`demo-${id}`,createdTime:time,updatedTime:time};
    const fixtures={
      task:{taskNo:`AGV20261015${String(id).padStart(4,'0')}`,taskStatus:Object.keys(options.taskStatus)[(id-1)%8],orderNo,businessCode:'DELIVERY',callNo:`CALL-${id}`,agvCode:`AGV-${String(1+id%3).padStart(2,'0')}`,agvName:`搬运机器人 ${1+id%3}`,schedulerTaskNo:`SCH-20261015-${id}`,containerId:boxIds[id%3],originLocationId:1,destinationLocationId:3,originLocationCode:'NJ-SMT-IN-01',destinationLocationCode:'NJ-SMT-DOCK-01',queueNo:id,triggerMode:'AUTO',dispatchMode:'NORMAL',destinationMode:'SPECIFIED',vendor:'STANDARD',sendAttemptCount:id%3,completedTime:(id-1)%8===4?time:null,statusUpdatedTime:time,lastSentTime:time,reason:(id-1)%8===5?'目标位置暂不可用，请查看实际调度反馈。':null,createRequestId:`REQ-T-${id}`,intentKey:`DELIVERY-${id}`,dispatchRequestSnapshot:JSON.stringify({taskNo:`AGV20261015${String(id).padStart(4,'0')}`,destinationLocationCode:'NJ-SMT-DOCK-01'}),warehouseBoxSnapshot:null},
      operation:{eventKey:`EVT-20261015-${id}`,eventType:['TASK_STATUS_CHANGED','WAREHOUSE_SUCCEEDED','RECEIVING_RECORDED'][id%3],operationKey:`OP-${id}`,taskId:id,containerId:boxIds[id%3],locationId:3,warehouseRecordId:id,receivingRecordId:id,occurredTime:time,evidenceSource:['DISPATCH','PDA','SYSTEM'][id%3],cancelStatus:null,taskVersion:1,requestId:`REQ-OP-${id}`,beforeState:'{"status":"RUNNING"}',afterState:'{"status":"COMPLETED"}',resultSnapshot:'{"accepted":true}',reason:null},
      warehouse:{applicationNo:`WH20261015${String(id).padStart(4,'0')}`,objectId:1000+id,requestId:`REQ-WH-${id}`,sapDocumentNos:`500010${String(id).padStart(4,'0')}`,submittedVersion:2,succeededTime:time},
      warehouseBox:{warehouseRecordId:Math.ceil(id/2),boxId:boxIds[id%3],activeBoxId:id%2?boxIds[id%3]:null,boxVersion:3,orderNo,materialCode:`MAT-${String(1000+id%4)}`,materialBatch:`B202610${id%3+1}`,quantity:id===1?0:96+id,wmsCleanupStatus:Object.keys(options.wmsCleanupStatus)[id%5],cleanupRequestId:`CLEAN-${id}`,contentKey:`CONTENT-${id}`,cleanupSentTime:time,cleanupCompletedTime:id%5===2?time:null,nextCheckTime:null,reason:id%5===3?'WMS 返回清理失败，等待后端处理。':null,bindingSnapshot:JSON.stringify({orderNo,quantity:96+id}),wmsScopeSnapshot:JSON.stringify({materialCode:`MAT-${1000+id%4}`})},
      receiving:{receivingNo:`RC20261015${String(id).padStart(4,'0')}`,boxId:boxIds[id%3],logisticsTaskId:id,warehouseRecordBoxId:id,receivedTime:time,requestId:`REQ-RC-${id}`,remark:id%4===0?'扫码接收，外观检查正常':null},
    };
    for(const [key,config] of Object.entries(pages)) {
      const record=Object.fromEntries([...config.details,...config.technical,...config.snapshots,...common].map(field=>[field,null]));
      rows[key].push({...record,...meta,...fixtures[key]});
    }
  }
  window.logisticsQueryData={fields,pages,common,rows};
})();
