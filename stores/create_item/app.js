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
// {  body: '{    "sku" : "ZH7SG35E",   "name" : "tomato", “description” : “ ohio potato”,   “price” : “2“， “max_quantity_per_shelf” : “50”}'
//
// }
//
// ===>  { "Created item successfully" }
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
        if (info.name !== "" && info.sku !== "" && info.max_quantity_per_shelf !== 0) {
            console.log(info.sku)
            return new Promise((resolve, reject) => {
                pool.query("INSERT INTO items (sku, name, descriptions, price, max_quantity_per_shelf, shelf, aisle) VALUES (?, ?, ?, ?, ?, ?, ?);"
                            , [info.sku , info.name, info.descriptions, info.price, info.max_quantity_per_shelf, info.shelf, info.aisle], (error, rows) => {
                    if (error) { return reject(error); }
                    if (rows) {
                        return resolve(1);
                    } else {
                        return reject("unable to create '" + info.name + "'");
                    }
                });
            });
        } else {
            // this is just the constant
            return new Promise((reject) => { return reject("SKU, name, and max number on shelf can not be null"); });
        }
    }
    
    try {
        
        // 1. Query RDS for the first constant value
        // 2. Query RDS for the second constant value
        // ----> These have to be done asynchronously in series, and you wait for earlier 
        // ----> request to complete before beginning the next one
        let arg1_value = await ComputeArgumentValue(info);
        
        // If either is NaN then there is an error
        if (isNaN(arg1_value)) {
            console.log("arg" + arg1_value.reject);
            response.statusCode = 400;
            response.error = JSON.stringify(arg1_value);
        } else {
            // otherwise SUCCESS!
            response.statusCode = 200;
           
            response.result = "Created item successfully";
        }
    } catch (error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
    }
    
    // full response is the final thing to send back
    return response;
}