// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// ++++++++++++++ Fault Monitor +++++++++++++++++++++++++++  
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//  Steve Troxel - July 2022
//  Reads the error_wd table and inserts faults and alarms
//  into the flt_buffer table

var timeDiff = 20000 // Time Difference Threshold in milliseconds

const _ = require('lodash');

const db = require('./mysqldb');
const config = require('./config');

var toID
var fltActiveLstPrev = []
var testFlg = false
var cnt = 0

async function process_flts() {
  sql = 'select * from error_wd order by time desc limit 1;'
  rows = await db.querys(sql)
  const wdObj = rows[0]
 
  //console.log(wdObj)

  // Set some bits for testing...
  //wdObj['error_wd2'] = 0x3
  //wdObj['error_wd6'] = 0x3
  //wdObj['error_wd7'] = 0x3
  //wdObj['error_wd8'] = 16

  let bit = []
  for(i=0;i<24;i++) { bit[i]=2**i }

  let fltConf = []
  fltConf[0]  = { msg:'String High Voltage - ', flt:0}
  fltConf[1]  = { msg:'String High Voltage - ', flt:1}
  fltConf[2]  = { msg:'String Low Voltage - ' , flt:0}
  fltConf[3]  = { msg:'String Low Voltage - ' , flt:1}
  fltConf[4]  = { msg:'String High Current - ', flt:0}
  fltConf[5]  = { msg:'String High Current - ', flt:1}
  fltConf[6]  = { msg:'String High Temperature - ', flt:0}
  fltConf[7]  = { msg:'String High Temperature - ', flt:1}
  fltConf[8]  = { msg:'Cell Low Voltage - ', flt:0}
  fltConf[9]  = { msg:'Cell Low Voltage - ', flt:1}
 
  // -------------- String Error Word -------------
  let fltActiveLst = []
  let j=0

  for ( let wd of ['error_wd1','error_wd2','error_wd3','error_wd4']){
    j = j + 1
    for ( let i in fltConf ) {
      if ( wdObj[wd] & bit[i]) {
        fltActiveLst.push([fltConf[i].msg + `String ${j}`,fltConf[i].flt])
      }
    }
  }

  // -------------- Aux Error Word -------------
  for ( let i in fltConf ) {
       if ( wdObj['error_wd6'] & bit[i]) {
        fltActiveLst.push([fltConf[i].msg + 'Aux',fltConf[i].flt])
      }
  }
 
  // -------------- Smoke/Fire Word -------------
  let err_wd = wdObj['error_wd7']
 
  if ( err_wd & bit[0] ) { fltActiveLst.push( ["Smoke Machine",1] ) }
  if ( err_wd & bit[1] ) { fltActiveLst.push( ["Smoke Battery",1] ) }
  if ( err_wd & bit[2] ) { fltActiveLst.push( ["Smoke EE",1] ) }

  if ( err_wd & bit[3] ) { fltActiveLst.push( ["Fire Machine",1] ) }
  if ( err_wd & bit[4] ) { fltActiveLst.push( ["Fire EE",1] ) }
  if ( err_wd & bit[5] ) { fltActiveLst.push( ["Fire Battery 1",1] ) }
  if ( err_wd & bit[6] ) { fltActiveLst.push( ["Fire Battery 2",1] ) }

  // -------------- Temperature Alarms/Faults Word -------------
  err_wd = wdObj['error_wd8']
 
  if ( err_wd & bit[0] ) { fltActiveLst.push(["Temperature Machine 1",0]) }
  if ( err_wd & bit[1] ) { fltActiveLst.push(["Temperature Machine 1",1]) }

  if ( err_wd & bit[2] ) { fltActiveLst.push(["Temperature Machine 2",0]) }
  if ( err_wd & bit[3] ) { fltActiveLst.push(["Temperature Machine 2",1]) }

  if ( err_wd & bit[4] ) { fltActiveLst.push(["Temperature EE",0]) }
  if ( err_wd & bit[6] ) { fltActiveLst.push(["Temperature EE",1]) }

  // Check processes times in order: propulsion, aux, env
  sql = 'select time from volts order by time desc limit 1;select time from volts_aux order by time desc limit 1;select time from env order by time desc limit 1;'
  rows = await db.querys(sql)

  rowsLbl = ["Propulsion ","Aux " ,"Env "]
  var now = new Date()
  for (i=0; i<3; i++) {
    let diff = now - new Date(rows[i][0].time)
    if ( diff > timeDiff) {
      fltActiveLst.push([rowsLbl[i] + "Data Not Updating",1])
    }  
  }

  // Bulk Insert note the encapsulating [] array brackets are necessary the docs are wrong.
  // Therefore the arg needs to be an array of an array of arrays - go figure.
  // The msql IGNORE is important so that if the flt/alm is already inserted it just skips over
  if ( fltActiveLst.length > 0 ) {
    var query = await db.querys('INSERT IGNORE INTO flt_buffer (msg,flt) VALUES ?', [fltActiveLst])
    if ( testFlg ) console.log(query)
  }

  // Check processes times in order: propulsion, aux, env
  sql = 'select time from volts order by time desc limit 1;select time from volts_aux order by time desc limit 1;select time from env order by time desc limit 1;'
  rows = await db.querys(sql)
  
  if ( !(cnt++ % 100) ) { console.log(`bems_flt alive - ${fltActiveLst.length} faults`); cnt=1}

  clearTimeout(toID)
  toID = setTimeout(process_flts,3000)
 
}

process_flts()