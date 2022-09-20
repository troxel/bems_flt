const mysql = require('mysql2/promise');
const config = require('./config');

//var connection = false
async function querys(sql, params) {

  //if ( connection == false ) 
  //{
    var connection = await mysql.createConnection(config.db)
    //console.log('got connection')
    //console.log("connection ",connection)
  //}
 
  try {
    const [results, ] = await connection.query(sql, params)
    connection.end()
    return results;

  } catch(err) {
    console.error('DB Error :', err.sqlMessage)
    connection.end()
    return false
  }
}

// ----------------------------------------
async function execute(sql, params) {

  //if ( connection == false ) 
  //{
    var connection = await mysql.createConnection(config.db)
    //console.log('got connection')
    //console.log("connection ",connection)
  //}
 
  try {
    const [results, ] = await connection.execute(sql, params)
    connection.end()
    return results;
    
  } catch(err) {
    console.error('DB Error :', err.sqlMessage)
    connection.end()
    return false
  }
}

module.exports = {
  querys, execute
}