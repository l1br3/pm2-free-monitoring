require('dotenv').config()
const cron = require('node-cron')
const request = require('request')
const influx = require('./model')

/*
* Node scheduler which runs on every 10 seconds.
*/

function getInfluxPointFromProcess (process) {
  if (process.name === 'pm2-http-interface' || process.name === 'pm2_monitoring') return null

  let envCode = process.pm2_env.NODE_ENV === 'production' ? 1 : -1
  envCode = process.pm2_env.NODE_ENV === 'development' ? 0 : envCode

  const influxPoint = {}
  influxPoint.measurement = 'pm2-node'
  influxPoint.tags = {
    host: process.name || null
  }
  influxPoint.fields = {
    NAME: process.name || null,
    CPU: process.monit.cpu || 0,
    MEM: process.monit.memory || 0,
    PROCESS_ID: process.pid || 0,
    RESTARTS: process.pm2_env.restart_time || 0,
    EXIT_CODE: process.pm2_env.exit_code || 0,
    VERSION: process.pm2_env.version || '1.0.0',
    BRANCH: process.pm2_env.versioning.branch || null,
    ENV: envCode
  }

  return influxPoint
}

module.exports.indentify_node_process = cron.schedule('*/10 * * * * *', function () {
  pm2Data().then(function (pm2Response) {
    const pm2DataResponse = JSON.parse(pm2Response)
    const points = pm2DataResponse.processes.map(getInfluxPointFromProcess).filter(point => point)
    influx.writePoints(points)
      .then(() => {
        console.log('write point success')
      })
      .catch(err => console.error(`write point fail,  ${err.message}`))
  }).catch((err) => {
    console.error(err)
  })
}, false)

/*
* this function make request to your pm2 microservices server and
* get all the data of all microservices.
*/
function pm2Data () {
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url: `http://${process.env.PM2_IP}:9615/`
    }, function (error, response, body) {
      if (error) {
        reject(error)
      } else if (response && response.statusCode === 200) {
        resolve(body)
      } else {
        reject(new Error('Did not get any response!'))
      }
    })
  })
}
