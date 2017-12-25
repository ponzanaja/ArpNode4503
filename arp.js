const express = require('express')
const firebase = require('firebase')
const snmp = require('snmp-native')
const dateFormat = require('dateformat')
//const app = express()
const inboundOID = [1, 3, 6, 1, 2, 1, 2, 2, 1, 10]
const outboundOID = [1, 3, 6, 1, 2, 1, 2, 2, 1, 16]
const packetinUOID = [1, 3, 6, 1, 2, 1, 2, 2, 1, 11]
const pktsInErrOID = [1, 3, 6, 1, 2, 1, 2, 2, 1, 14]
const pktsOutErrOID = [1, 3, 6, 1, 2, 1, 2, 2, 1, 14]
const intNameOID = [1, 3, 6, 1, 2, 1, 2, 2, 1, 2]
const intSpeed = [1, 3, 6, 1, 2, 1, 2, 2, 1, 5]
const nodeNIP = '192.168.1.254'
/* root / root1234 10.4.15.1 */ 
const {exec} = require('child_process')

let config = {
  apiKey: 'AIzaSyCjFxu7Ft4mfHp8ksLYoRkOSWeK4tRmI0w',
  authDomain: 'showdowndata.firebaseapp.com',
  databaseURL: 'https://showdowndata.firebaseio.com',
  projectId: 'showdowndata',
  storageBucket: 'showdowndata.appspot.com',
  messagingSenderId: '811451470025'
}
firebase.initializeApp(config)
// get data from firebase
let db = firebase.database().ref('db')

let dbInfo = []
// when you have some data update
db.on('child_added', function (snapshot) {
  let item = snapshot.val()
  item.id = snapshot.key
  dbInfo.push(item)
})
// checking for update from firebase
db.on('child_changed', function (snapshot) {
  let id = snapshot.key
  let sNode = dbInfo.find(info => info.id === id)
  /* sNode.node = snapshot.val().node
  sNode.ip = snapshot.val().ip
  sNode.onlinenow = snapshot.val().onlinenow
  sNode.inbound = snapshot.val().inbound
  sNode.outbound = snapshot.val().outbound
  sNode.speedtestUp = snapshot.val().speedtestUp
  sNode.speedtestDown = snapshot.val().speedtestDown
  sNode.utilize = snapshot.val().utilize
  sNode.packetloss = snapshot.val().packetloss
  console.log( ' CHANGE dbInfo \n ' + dbInfo) */
})
/// //////////////////// Network letiable Start here ///////////////////////
let dataGet = ''
let online = ''
let ipNow = ''
let sumInbound = 0
let sumOutbound = 0
let download = 0
let upload = 0
let sumInpkts = 0
let packetloss = 0
let temparature = 0
let humanity = 0
let counterInt = 0
/// //////////////////// Network letiable End here ///////////////////////

/* ---------------------------------------------------------------------- */

setInterval(() => {
  /// //////////////////// Date letiable Start here ///////////////////////
  let now = new Date()
  let date = dateFormat(now, 'd/m/yyyy')
  let time = dateFormat(now, 'HH:MM:ss')
  /// //////////////////// Date letiable End here ////////////////////////
  showResult()
  sendtoFirebase('Node2', date, time)
  speedTest().then((result) => {
    let newResult = result.replace(/(\r\n|\n|\r)/gm, '')
    let indexOfdownload = newResult.indexOf('M')
    let indexOfupload = newResult.indexOf('s')
    let indexOfupload2 = newResult.lastIndexOf('M')
    download = newResult.slice(0, indexOfdownload)
    upload = newResult.slice(indexOfupload + 1, indexOfupload2)
    download = download.trim()
    upload = upload.trim()
  })
  getMIB('Node2', date, time)
  sendTemparature().then((result) => {
    let newResult = result.replace(/(\r\n|\n|\r)/gm, '')
    let indexOfTemparature = newResult.indexOf('T')
    humanity = newResult.slice(1,indexOfTemparature)
    temparature = newResult.slice(indexOfTemparature+1 )
    humanity = humanity.trim()
    temparature = temparature.trim()
  })
}, 60000)

function showResult () {
  getIP().then(getOnline).then((data) => {
    dataGet = data
    let indexOfuser = dataGet.lastIndexOf('(')
    let onlineUser = dataGet.slice(indexOfuser + 1, indexOfuser + 2)
    online = onlineUser
  }).catch((error) => {
    console.error(error.message)
  })
}

function getIP () {
  // console.log("We're getting in IP")
  return new Promise((resolve, reject) => {
    exec('/sbin/ifconfig eth0 | grep \'inet addr:\' | cut -d: -f2 | awk \'{ print $1}\'', (err, stdout, stderr) => {
      if (err) reject("get IP Error :"+err)
      else resolve(ipNow = `${stdout}`)
    })
  })
}

function getOnline (ip) {
  //console.log('This Is IP Parameter ' + ip)
  let newIP = ip.replace(/(\r\n|\n|\r)/gm, '').concat('/24')
  return new Promise((resolve, reject) => {
    exec('nmap -sP ' + newIP, (err, stdout, stderr) => {
      if (err) return reject("get Online Error : "+err)
      else resolve(`${stdout}`)
    })
  })
}

function sendtoFirebase (nodeName, date, time) {
  let check = dbInfo.find(info => info.node === nodeName)
  let temparatureData = {
    valueh: humanity,
    valuet: temparature,
    date: date,
    time: time 
  }
  let spdtestData = {
    valuedown: download,
    valueup: upload,
    date: date,
    time: time
  }
  if (check) {
    let spdcheck = check.speedtest
    let temparacheck = check.temparature
    spdcheck.push(spdtestData)
    temparacheck.push(temparatureData)
    firebase.database().ref('db/' + check.id).update({
      ip: ipNow,
      onlinenow: online,
      speedtest: spdcheck,
      temparature: temparacheck,
      alive:true,
      alive2:true
    })
  } else {
    let sendData = {
      node: nodeName,
      ip: ipNow,
      onlinenow: online,
      inbound: [{
        value: 0,
        date: date,
        time: time
      }],
      outbound: [{
        value: 0,
        date: date,
        time: time
      }],
      speedtest: [{
        valuedown: download,
        valueup: upload,
        date: date,
        time: time
      }],
      temparature: [{
        valueh: 0,
        valuet: 0,
        date: date,
        time: time
      }],
      utilizein: 0,
      utilizeout:0,
      packetloss: 0,
      alive: true,
      alive2: true

    }
    return new Promise((resolve, reject) => {
      if (!db.push(sendData)) return Promise.reject(new Error('something bad happened'))
      else return resolve(db.push(sendData))
    })
  }
}
// ////////////////////////////////// Getting MIB /////////////////////////////////////////////
function getMIB (nodeName, date, time) {
  let deviceNetwork = new snmp.Session({
    host: nodeNIP
  }) // 10.4.15.1 // 192.168.1.254
  // getInbound
  let inbound = []
  deviceNetwork.getSubtree({
    oid: inboundOID
  }, function (err, letbinds) {
    if (err) {
      console.log(err)
    } else {
      letbinds.forEach((letbind) => {
        let data = {
          indexOID: letbind.oid[10],
          inbound: parseInt(letbind.value / 1048576)
        }
        inbound.push(data)
      })
      // console.log(inbound) out commend for checking data
    }
  })
  // getOutbound
  let outbound = []
  deviceNetwork.getSubtree({
    oid: outboundOID
  }, function (err, letbinds) {
    if (err) {
      console.log(err)
    } else {
      letbinds.forEach((letbind) => {
        let data = {
          indexOID: letbind.oid[10],
          outbound: parseInt(letbind.value / 1048576)
        }
        outbound.push(data)
      })
      //  console.log(outbound) out commend for checking data
    }
  })

  // getPacketU
  let packetinU = []
  deviceNetwork.getSubtree({
    oid: packetinUOID
  }, function (err, letbinds) {
    if (err) {
      console.log(err)
    } else {
      letbinds.forEach((letbind) => {
        let data = {
          indexOID: letbind.oid[10],
          pktsinu: letbind.value
        }
        packetinU.push(data)
      })
      //  console.log(packetinU) out commend for checking data
    }
  })

  // getPktsInErr
  let pktsInErr = []
  deviceNetwork.getSubtree({
    oid: pktsInErrOID
  }, function (err, letbinds) {
    if (err) {
      console.log(err)
    } else {
      letbinds.forEach((letbind) => {
        let data = {
          indexOID: letbind.oid[10],
          pktsinerr: letbind.value
        }
        pktsInErr.push(data)
      })
      //  console.log(pktsInErr) out commend for checking data
    }
  })

  // getPktsOutErr
  let pktsOutErr = []
  deviceNetwork.getSubtree({
    oid: pktsOutErrOID
  }, function (err, letbinds) {
    if (err) {
      console.log(err)
    } else {
      letbinds.forEach((letbind) => {
        let data = {
          indexOID: letbind.oid[10],
          pktsouterr: letbind.value
        }
        pktsOutErr.push(data)
      })
      //  console.log(packetinU) out commend for checking data
    }
  })

  let intName = []
  let countInterface = 0
  deviceNetwork.getSubtree({
    oid: intNameOID
  }, function (err, letbinds) {
    if (err) {
      console.log(err)
    } else {
      letbinds.forEach((letbind) => {
        let data = {
          indexOID: letbind.oid[10],
          intName: letbind.value
        }
        intName.push(data)
        if ((letbind.value).toString().toLowerCase().charAt(0) === 'f' || (letbind.value).toString().toLowerCase().charAt(0) === 'g') {
          countInterface++
          counterInt++
        }
      })
      // console.log(intName)  // out commend for checking data
    }

    let suminpktU = 0
    let suminpktsErr = 0
    for (let i = 0; i < countInterface; i++) {
      sumInbound += inbound[i].inbound
      sumOutbound += outbound[i].outbound
      suminpktU += packetinU[i].pktsinu
      suminpktsErr += pktsInErr[i].pktsinerr
    }
    sumInpkts = suminpktU
    if (sumInpkts !== 0) {
      packetloss = (suminpktsErr / sumInpkts) * 100
    } else {
      packetloss = 0
    }
    //console.log('Sum inbound : ' + sumInbound)
    //console.log('Sum PacketIn :' + sumInpkts)
    //console.log('Packetloss : ' + packetloss)
  })

  let intSpd =  []
  deviceNetwork.getSubtree({
    oid: intSpeed
  }, function (err, letbinds) {
    if (err) {
      console.log(err)
    } else {
      letbinds.forEach((letbind) => {
        let data = {
          indexOID: letbind.oid[10],
          intSpd: letbind.value
        }
        intSpd.push(data)
      })
      // console.log(intName)  // out commend for checking data
    }
  })

  let check = dbInfo.find(info => info.node === nodeName)
  if (check) {
    let checkInbound = check.inbound
    let checkOutbound = check.outbound
    let insertIn = {
      value: sumInbound,
      date: date,
      time: time
    }
    let insertOut = {
      value: sumOutbound,
      date: date,
      time: time
    }
    checkInbound.push(insertIn)
    checkOutbound.push(insertOut)
    firebase.database().ref('db/' + check.id).update({
      inbound: checkInbound,
      outbound: checkOutbound,
      packetloss: packetloss
    })
    sumInbound = sumOutbound = sumInpkts = suminpktU = suminpktsErr = 0
  }console.log("counterInterface2 = "+counterInt)
    console.log( "intSpd = " + intSpd)
  calculateUtilize(countInterface,intSpd,nodeName)
}


function speedTest () {
  return new Promise((resolve, reject) => {
    exec('python speedtest-cli | grep \'Download:\\|Upload:\'|cut -d: -f2', {
      cwd: '/project1'
    }, (err, stdout, stderr) => {
      setTimeout(() => {
        if (err) return reject("SpeedTest Error : " + err)
        else resolve(`${stdout}`)
      })
    })
  })
}

function calculateUtilize (countInterface,interfaceSpeed,nodeName) {
  let sumUtilizeIn  = 0
  let sumUtilizeOut = 0
  let sumInterface = 0
  for (let i = 0; i < countInterface; i++) {
    sumInterface += interfaceSpeed[i].intSpd
  }
  sumInterface = sumInterface/countInterface
  console.log("suminterface = "+sumInterface)
  let data =  dbInfo.find(info => info.node === nodeName)
  let inbound1 = data.inbound[data.inbound.length-1].value
  let inbound2 = data.inbound[data.inbound.length-2].value
  let outbound1 = data.outbound[data.outbound.length-1].value
  let outbound2 = data.outbound[data.outbound.length-2].value
  let sumIn = (inbound2 - inbound1)
  let sumOut = (outbound2 - outbound1)
  
  sumIn = sumIn/(60*sumInterface)
  sumOut = sumOut/(60*sumInterface)
  console.log("Sum In =" + sumIn + "Sum Out = " + sumOut)
  if(isNaN(sumIn)) sumIn = 0
  if(isNaN(sumOut)) sumOut = 0
  firebase.database().ref('db/' + data.id).update({
    utilizein: sumIn,
    utilizeout: sumOut
  })
}

function sendTemparature () {
  return new Promise((resolve, reject) => {
    exec('sudo ./dht', {
      cwd: '/project1'
    }, (err, stdout, stderr) => {
      setTimeout(() => {
        if (err) return reject("get Temparature Error : " + err)
        else resolve(`${stdout}`)
      })
    })
  })
}
/* // Define port number as 3000
const port = 3000
// Routes HTTP GET requests to the specified path "/" with the specified callback function
app.get('/', function (request, response) {
  response.send(ipNow + 'ออนไลน์ user' + online)
})
// Make the app listen on port 3000
app.listen(port, function () {
  console.log('Server listening on http://localhost:' + port)
}) */
