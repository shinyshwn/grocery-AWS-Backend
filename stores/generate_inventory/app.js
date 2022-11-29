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

    var inventory_result = [];
    var item_prices = [];
    var store_total_value = 0; 
    let actual_event = event.body;
    let info = JSON.parse(actual_event);
    console.log("info:" + JSON.stringify(info)); //  info.arg1 and info.arg2

    // get raw value or, if a string, then get from database if exists.
    let getInventory = (info) => {
        if (info.store_id != "" && info.store_id != null) {
            console.log(info.store_id)
            return new Promise((resolve, reject) => {
                pool.query("SELECT sku, quantity FROM inventory WHERE store_id = ?;" , [info.store_id], (error, rows) => {
                                if (error) {
                                    console.log("error"); 
                                    // return reject(error); 
                                    return reject(error)
                                }
                                if(rows){
                                    if(rows.length < 1){
                                        return reject(" No inventory for the store ")
                                    }
                                    inventory_result = rows; 
                                    //console.log(JSON.stringify(inventory_result));
                                    //console.log(rows.length);
                                    return resolve(true)
                                }
                                else{
                                    return reject("unable to get inventory from the table " + info.store_id);
                                }
                            })
            });
        }
        else {
             return new Promise((reject) => { return reject("store id can not be empty"); });
        }
    }
    
    let getPrice = (info) => {
        if (info.store_id != "" && info.store_id != null) {
            return new Promise((resolve, reject) => {
                pool.query("SELECT sku, price FROM items WHERE sku IN (SELECT sku FROM inventory WHERE store_id=?);" , [info.store_id], (error, rows) => {
                                if (error) {
                                    console.log("error"); 
                                    // return reject(error); 
                                    return reject(error)
                                }
                                if(rows){
                                    item_prices = rows; 
                                    //console.log(JSON.stringify(item_prices));
                                    return resolve(true)
                                }
                                else{
                                    return reject("unable to get prices from the table ");
                                }
                            })
            });
        }
        else {
             return new Promise((reject) => { return reject("get prices: store id can not be empty"); });
        }
    }
    

    try {
        
        // 1. Query RDS for the first constant value
        // 2. Query RDS for the second constant value
        // ----> These have to be done asynchronously in series, and you wait for earlier 
        // ----> request to complete before beginning the next one
        let getInven = await getInventory(info);
        let getP = await getPrice(info);

        
        // If either is NaN then there is an error
        if (getInven == true) {
            
            let arr3 = inventory_result.map((item, i) => Object.assign({}, item, item_prices[i]));
            //console.log(arr3); 
            arr3.forEach((entry) =>{
            
                entry.item_total_value = entry.price * entry.quantity;
                store_total_value = store_total_value + entry.item_total_value;
                //console.log(entry);
            
            });
            //console.log(store_total_value);
            let store_inventroy_total_value = "store_total_inventroy_value: " + store_total_value; 
            arr3.push(store_inventroy_total_value); 
            //console.log(arr3);
            response.statusCode = 200;
            // response.result = JSON.stringify(arg1_value);
           
            response.result = arr3;
            
        } else {
            // otherwise SUCCESS!
            console.log("error: " + getInven.reject);
            response.statusCode = 400;
            response.error = JSON.stringify(getInven);
        }
    } catch (error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
    }
    
    // full response is the final thing to send back
    return response;
}

