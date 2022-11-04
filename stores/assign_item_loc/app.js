// const axios = require('axios')
// const url = 'http://checkip.amazonaws.com/';
let response;
const mysql = require('mysql');

var config = require('./config.json');
var pool = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
});

// https://www.freecodecamp.org/news/javascript-promise-tutorial-how-to-resolve-or-reject-promises-in-js/#:~:text=Here%20is%20an%20example%20of,message%20Something%20is%20not%20right!%20.
function query(conx, sql, params) {
    return new Promise((resolve, reject) => {
         conx.query(sql, params, function(err, rows) {
            if (err) {
                // reject because there was an error
                reject(err);
            } else {
                // resolve because we have result(s) from the query. it may be an empty rowset or contain multiple values
                resolve(rows);
            }
        });
    });
}


// Take in as input a payload.
//
// {  body: '{"sku" : "ZH7SG35E",   "aisle" : "2", “shelf” : “6”}'
//
// }
//
// ===>  { "statuscode" : 200}
//
//
//
exports.lambdaHandler = async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;

   // ready to go for CORS. To make this a completed HTTP response, you only need to add a statusCode and a body.
    let response = {
        headers: {
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Origin": "*", // Allow from anywhere
            "Access-Control-Allow-Methods": "POST" // Allow POST request
        }
    }; // response


    let actual_event = event.body;
    let info = JSON.parse(actual_event);
    console.log("info:" + JSON.stringify(info)); //  info.sku , info.shelf, info.aisle
    var sqlinsert = "UPDATE items SET aisle = ?, shelf= ? WHERE sku = ?";
    
    try {
        
        new Promise((resolve, reject) => {
                pool.query(sqlinsert, [info.aisle, info.shelf, info.sku], (error, rows) => {
                    if (error) { return reject(error); }
                    if (rows) {
                        return resolve(rows);
                    } else {
                        return reject("unable to assign item location'" + info.sku + "'");
                    }
                });
            });
            
        // If either is NaN then there is an error
        if (!info.shelf || !info.aisle) {
            response.statusCode = 400;
            response.error = "shelf and aisle can not be null";
        } else {
            // otherwise SUCCESS!
            response.statusCode = 200;
        }
    } catch (error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
    }
    
    // full response is the final thing to send back
    return response;
}