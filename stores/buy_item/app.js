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
    //event.body: store_id, sku, quantity
    let info = JSON.parse(actual_event);
    console.log("info:" + JSON.stringify(info)); //  info.store_id, info.sku, info.quantity
    

    // get raw value or, if a string, then get from database if exists.
    let ComputeArgumentValue = (info) => {
        if (info.store_id !== "" && info.sku !== "" && info.quantity !== 0) {
            return new Promise((resolve, reject) => {
                pool.query("UPDATE inventory SET quantity= quantity-? WHERE store_id=? AND sku=? AND quantity>=?"
                            , [info.quantity , info.store_id, info.sku, info.quantity], (error, rows) => {
                    if (error) { console.log("arg" + JSON.stringify(error)); return reject(error);  }
                    if (rows) {
                        console.log("arg result" + JSON.stringify(rows));
                        return resolve(rows.affectedRows);
                    } else {
                        console.log("arg" + JSON.stringify("else"));
                        return reject("Item '" + info.sku + " is not avaliable");
                    }
                });
            });
        } else {
            // this is just the constant
            return new Promise((reject) => { return reject("SKU, store_id, and quantity can not be null"); });
        }
    }
    
    try {
        
        // 1. Query RDS for the first constant value
        // 2. Query RDS for the second constant value
        // ----> These have to be done asynchronously in series, and you wait for earlier 
        // ----> request to complete before beginning the next one
        let arg1_value = await ComputeArgumentValue(info);
        console.log("arg" + arg1_value);
        
        // If either is NaN then there is an error
        if (isNaN(arg1_value)) {
            console.log("arg" + JSON.stringify(arg1_value));
            response.statusCode = 400;
            response.error = JSON.stringify(arg1_value);
        } else if (arg1_value > 0) {
            // otherwise SUCCESS!
            response.statusCode = 200;
           
            response.result = "Bought item successfully";
        }else {
            response.statusCode = 400;
           
            response.result = "Not enough item on shelf";
        }
    } catch (error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
    }
    
    // full response is the final thing to send back
    return response;
}