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
// {
//   "body" : "{ \"sku\" : \"ZH7Sf35E\", \"shelf\" : \"5\" , \"aisle\" : \"100\"}"
// }
//
// ===>  { "Assigned location successfully" }
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
    let ComputeArgumentValue = (info) => {
        if (info.store_id != "" && info.store_id != null) {
            console.log(info.store_id)
            return new Promise((resolve, reject) => {
                pool.query("SELECT sku, quantity, overstock, unit_price FROM inventory where store_id = ?;"
                            , [info.store_id], (error, rows) => {
                                if (error) {
                                    console.log("error"); 
                                    // return reject(error); 
                                    return reject(1)
                                }
                                if(rows){
                                    for(let row in rows){
                                        let total_value = (rows[row].quantity + rows[row].overstock) * rows[row].unit_price; 
                                        console.log(total_value); 
                                        rows[row].total_value = total_value; 
                                    }
                                    console.log("successful");
                                    return resolve(rows)
                                }
                                else{
                                    return reject("unable to generate inventory report for store " + info.store_id);
                                }
                            })
            });
        }
        else {
             return new Promise((reject) => { return reject(1); });
        }
    }
    // let ComputeArgumentValue = (info) => {
    //     if (info.sku !== "") {
    //         console.log(info.sku)
    //         return new Promise((resolve, reject) => {
    //             pool.query("UPDATE items SET shelf = ?, aisle = ? WHERE sku = ?;"
    //                         , [info.shelf, info.aisle, info.sku], (error, rows) => {
    //                 if (error) { console.log("return 2" ); return reject(error); }
    //                 if (rows) {
    //                     console.log("arg return 1");
    //                     return resolve(1);
    //                 } else {
    //                     return reject("unable to update location for '" + info.sku + "'");
    //                 }
    //             });
    //         });
    //     } else {
    //         // this is just the constant
    //         return new Promise((reject) => { return reject("SKU can not be empty"); });
    //     }
    // }
    
    try {
        
        // 1. Query RDS for the first constant value
        // 2. Query RDS for the second constant value
        // ----> These have to be done asynchronously in series, and you wait for earlier 
        // ----> request to complete before beginning the next one
        let arg1_value = await ComputeArgumentValue(info);
        
        // If either is NaN then there is an error
        if (arg1_value === 1) {
            console.log("error: " + arg1_value.reject);
            response.statusCode = 400;
            response.error = JSON.stringify(arg1_value);
        } else {
            // otherwise SUCCESS!
            response.statusCode = 200;
            // response.result = JSON.stringify(arg1_value);
           
            response.result = arg1_value;
        }
    } catch (error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
    }
    
    // full response is the final thing to send back
    return response;
}

