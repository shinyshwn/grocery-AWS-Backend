// const axios = require('axios')
// const url = 'http://checkip.amazonaws.com/';
let response;
const mysql = require('mysql');

var config = require('./config.json');
//create a mysql pool 
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
// {  body: '{    "id" : "123456",   "longitude" : "42.26259", “altitude” : “ -71.80229”}'
//
// }
//
// ===>  { "Created item successfully" }
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
    console.log("info:" + JSON.stringify(info)); //  info.arg1 and info.arg2

    // get raw value or, if a string, then get from database if exists.
    // let ComputeArgumentValue = (info) => {
    //     if (info.id !== "" ) {
    //         console.log(info.id)
    //         return new Promise((resolve, reject) => {
    //             pool.query("INSERT INTO stores (id , longitude, latitude) VALUES (?, ?, ?);"
    //                         , [info.id , info.longitude, info.latitude], (error, rows) => {
    //                 if (error) { return reject(error); }
    //                 if (rows) {
    //                     return resolve(1);
    //                 } else {
    //                     return reject("unable to create '" + info.id + "'");
    //                 }
    //             });
    //         });
    //     } else {
    //         // this is just the constant
    //         return new Promise((reject) => { return reject("Store id can not be empty"); });
    //     }
    // }
    
    let ComputeArgumentValue = (info) => {
        if (info.store_ID !== "" ) {
            console.log(info.store_ID)
            return new Promise((resolve, reject) => {
                pool.query("SELECT sku FROM items WHERE aisle = ? and shelf = ?;"
                            , [info.aisle , info.shelf], (error, rows) => {
                    if (error) { return reject(error); }
                    if (rows) {
                        console.log(rows)
                        return resolve(1);
                    } else {
                        return reject("unable to list sku");
                    }
                });
            });
        } else {
            // this is just the constant
            return new Promise((reject) => { return reject("Store id can not be empty"); });
        }
    }
    
    let ComputeArgumentValue2 = (arg1_value, info) => {
        if (arg1_value.sku !== "" ) {
            console.log(arg1_value.sku)
            return new Promise((resolve, reject) => {
                pool.query("SELECT quantity FROM inventory WHERE store_ID = ? and sku = ?;"
                            , [info.store_ID , arg1_value.sku], (error, rows) => {
                    if (error) { return reject(error); }
                    if (rows) {
                        console.log(rows)
                        return resolve(1);
                    } else {
                        return reject("unable to list quantities");
                    }
                });
            });
        } else {
            // this is just the constant
            return new Promise((reject) => { return reject("SKU can not be empty"); });
        }
    }
    
    try {
        
        // 1. Query RDS for the first constant value
        // 2. Query RDS for the second constant value
        // ----> These have to be done asynchronously in series, and you wait for earlier 
        // ----> request to complete before beginning the next one
        let arg1_value = await ComputeArgumentValue(info);
        let arg2_value = await ComputeArgumentValue2(arg1_value, info)
        
        // If either is NaN then there is an error
        if (isNaN(arg1_value)) {
            console.log("arg" + arg1_value.reject);
            response.statusCode = 400;
            response.error = JSON.stringify(arg1_value);
        } else {
            // otherwise SUCCESS!
            response.statusCode = 200;
           
            response.result = "Listed SKU successfully";
        }
        
        if (isNaN(arg2_value)) {
            console.log("arg" + arg2_value.reject);
            response.statusCode = 400;
            response.error = JSON.stringify(arg2_value);
        } else {
            // otherwise SUCCESS!
            response.statusCode = 200;
           
            response.result = "Listed quantities successfully";
        }
    } catch (error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
    }
    
    // full response is the final thing to send back
    return response;
}